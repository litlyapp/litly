import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
// Crawl-delay compliance makes this a slow route: pw.org asks for 10s between
// requests, so a full run (listing + up to MAX_PER_RUN detail pages) takes minutes.
export const maxDuration = 300;

const LISTING_URLS = [
  // Online/virtual events, national
  "https://www.pw.org/calendar?field_event_online_value=2",
];
const EVENT_PATH = /href="(\/literary_events\/[a-z0-9_]+)"/g;
const CRAWL_DELAY_MS = 10_000; // pw.org robots.txt: Crawl-delay: 10
const MAX_PER_RUN = 5;
const USER_AGENT = "litlybot/1.0 (+https://thelitlyapp.com; literary events curation; contact: support@thelitlyapp.com)";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    console.error(`[crawl-pw] ${res.status} fetching ${url}`);
    return null;
  }
  return res.text();
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // 1. Collect event detail URLs from the listing pages
    const found = new Set<string>();
    for (const listing of LISTING_URLS) {
      const html = await fetchPage(listing);
      if (!html) continue;
      for (const match of html.matchAll(EVENT_PATH)) {
        found.add(`https://www.pw.org${match[1]}`);
      }
      await sleep(CRAWL_DELAY_MS);
    }

    const urls = [...found];
    if (urls.length === 0) {
      return NextResponse.json({ ok: true, discovered: 0, queued: 0 });
    }

    // 2. Skip URLs already queued (source_subject holds the URL for crawler
    //    items) or already imported as events
    const [{ data: queued }, { data: imported }] = await Promise.all([
      supabase.from("pending_imports").select("source_subject").in("source_subject", urls),
      supabase.from("events").select("source_url").in("source_url", urls),
    ]);
    const seen = new Set([
      ...(queued ?? []).map((r) => r.source_subject),
      ...(imported ?? []).map((r) => r.source_url),
    ]);
    const fresh = urls.filter((u) => !seen.has(u)).slice(0, MAX_PER_RUN);

    // 3. Fetch each detail page, parse with Claude, queue for review
    let queuedCount = 0;
    for (const url of fresh) {
      const html = await fetchPage(url);
      if (!html) {
        await sleep(CRAWL_DELAY_MS);
        continue;
      }
      const text = htmlToText(html).slice(0, 8000);

      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `You are a literary event extractor for litly, a platform for literary events.

This text is from a single event detail page on the Poets & Writers calendar (pw.org). Extract the ONE event it describes.

Return a single JSON object:
{
  "title": "Event title",
  "description": "1-3 sentence summary IN YOUR OWN WORDS — do not copy the page's description verbatim (string or null)",
  "genre": ["array of applicable: poetry, fiction, nonfiction, essay, translation, ya, craft_talk, open_mic, workshop, in_conversation, slam"],
  "event_type": "in_person or virtual",
  "date_time": "ISO 8601 with timezone offset or null",
  "end_time": "ISO 8601 or null",
  "location_name": "venue name or null",
  "address": "street address or null",
  "city": "string or null",
  "state": "string or null",
  "country": "string or null",
  "virtual_url": "registration/zoom link if virtual, or null",
  "ticket_url": "ticket/registration link or null",
  "ignore": false
}

Set "ignore": true if the page is not actually a single literary event (e.g. an error page or index page).
Current year is 2026. If a date mentions only month/day, assume 2026.
Return ONLY a valid JSON object, no other text.

Page text:
${text}`,
          },
        ],
      });

      const content = message.content[0];
      if (content.type === "text") {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const event = JSON.parse(jsonMatch[0]);
          if (!event.ignore && event.title) {
            const { error } = await supabase.from("pending_imports").insert({
              source_email: "crawler@pw.org",
              source_subject: url,
              raw_body: text.slice(0, 10000),
              parsed_data: {
                ...event,
                source_url: url,
                source_name: "Poets & Writers",
              },
              status: "pending",
            });
            if (error) console.error(`[crawl-pw] insert failed for ${url}:`, error.message);
            else queuedCount++;
          }
        }
      }

      await sleep(CRAWL_DELAY_MS);
    }

    return NextResponse.json({
      ok: true,
      discovered: urls.length,
      new: fresh.length,
      queued: queuedCount,
    });
  } catch (error) {
    console.error("[crawl-pw] error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
