import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { TIME_RULES } from "@/lib/importParsing";

export const dynamic = "force-dynamic";
// Slow by design: polite crawl delays across several sites. Budgeted to stay
// under 300s — if adding sources, recheck the math (see delays below).
export const maxDuration = 300;

interface CrawlSource {
  /** Shown as source_name on imported events and in the admin queue */
  name: string;
  /** Marker for pending_imports.source_email */
  sourceEmail: string;
  listingUrls: string[];
  /** Must capture enough in group 1 to build the detail-page URL */
  linkPattern: RegExp;
  toUrl: (match: RegExpMatchArray) => string;
  /** Seconds between requests to this host (robots.txt Crawl-delay or politeness default) */
  delaySeconds: number;
}

const SOURCES: CrawlSource[] = [
  {
    name: "Poets & Writers",
    sourceEmail: "crawler@pw.org",
    listingUrls: ["https://www.pw.org/calendar?field_event_online_value=2"],
    linkPattern: /href="(\/literary_events\/[a-z0-9_]+)"/g,
    toUrl: (m) => `https://www.pw.org${m[1]}`,
    delaySeconds: 10, // robots.txt Crawl-delay: 10
  },
  {
    name: "Academy of American Poets",
    sourceEmail: "crawler@poets.org",
    listingUrls: ["https://poets.org/poetry-near-you"],
    linkPattern: /href="(\/event\/[a-z0-9-]+)"/g,
    toUrl: (m) => `https://poets.org${m[1]}`,
    delaySeconds: 2,
  },
  {
    name: "Literary Arts",
    sourceEmail: "crawler@literary-arts.org",
    listingUrls: ["https://literary-arts.org/events/"],
    linkPattern: /href="(https:\/\/literary-arts\.org\/event\/[a-z0-9-]+\/?)"/g,
    toUrl: (m) => m[1],
    delaySeconds: 2,
  },
  {
    name: "National Book Foundation",
    sourceEmail: "crawler@nationalbook.org",
    listingUrls: ["https://www.nationalbook.org/events-calendar/"],
    // Event URLs only appear URL-encoded in share-button data-url attributes
    linkPattern: /data-url="(https%3A%2F%2Fwww\.nationalbook\.org%2Fevents%2F[a-z0-9-]+%2F)"/g,
    toUrl: (m) => decodeURIComponent(m[1]),
    delaySeconds: 2,
  },
];

const MAX_PER_SITE = 5;
const USER_AGENT =
  "litlybot/1.0 (+https://thelitlyapp.com; literary events curation; contact: support@thelitlyapp.com)";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) {
      console.error(`[crawl-calendars] ${res.status} fetching ${url}`);
      return null;
    }
    return res.text();
  } catch (e) {
    console.error(`[crawl-calendars] fetch failed for ${url}:`, e);
    return null;
  }
}

function htmlToText(html: string): string {
  // Prefer the page's main-content region — sites like pw.org carry 10k+
  // chars of nav boilerplate that would otherwise crowd out the event text
  const main =
    html.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1] ??
    html.match(/<[^>]+id="(?:main-content|content)"[^>]*>([\s\S]*)/i)?.[1] ??
    html;
  // The <h1> often sits outside <main>/<article> — keep the page title in view
  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return (pageTitle + " | " + main)
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

  const summary: Record<string, { discovered: number; new: number; queued: number }> = {};

  for (const source of SOURCES) {
    const delayMs = source.delaySeconds * 1000;
    try {
      // 1. Collect detail-page URLs from this source's listing pages
      const found = new Set<string>();
      for (const listing of source.listingUrls) {
        const html = await fetchPage(listing);
        if (html) {
          for (const match of html.matchAll(source.linkPattern)) {
            found.add(source.toUrl(match));
          }
        }
        await sleep(delayMs);
      }

      const urls = [...found];
      summary[source.name] = { discovered: urls.length, new: 0, queued: 0 };
      if (urls.length === 0) continue;

      // 2. Skip URLs already queued or already imported as events
      const [{ data: queued }, { data: imported }] = await Promise.all([
        supabase.from("pending_imports").select("source_subject").in("source_subject", urls),
        supabase.from("events").select("source_url").in("source_url", urls),
      ]);
      const seen = new Set([
        ...(queued ?? []).map((r) => r.source_subject),
        ...(imported ?? []).map((r) => r.source_url),
      ]);
      const fresh = urls.filter((u) => !seen.has(u)).slice(0, MAX_PER_SITE);
      summary[source.name].new = fresh.length;

      // 3. Fetch each detail page, parse with Claude, queue for review
      for (const url of fresh) {
        const html = await fetchPage(url);
        if (!html) {
          await sleep(delayMs);
          continue;
        }
        const text = htmlToText(html).slice(0, 16000);

        const message = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `You are a literary event extractor for litly, a platform for literary events.

This text is from a single event detail page on the ${source.name} website. Extract the ONE event it describes.

Return a single JSON object:
{
  "title": "Event title",
  "description": "1-3 sentence summary IN YOUR OWN WORDS — do not copy the page's description verbatim (string or null)",
  "genre": ["array of applicable: poetry, fiction, nonfiction, translation, ya, craft_talk, open_mic, workshop, in_conversation, slam, other (use other only when clearly literary but nothing else fits)"],
  "event_type": "in_person or virtual",
  "date_time": "ISO 8601 or null",
  "end_time": "ISO 8601 or null",
  "time_confirmed": "true only if the page explicitly states a start time, false otherwise",
  "timezone": "IANA timezone implied by the event location (e.g. America/New_York) or null",
  "location_name": "venue name or null",
  "address": "street address or null",
  "city": "string or null",
  "state": "string or null",
  "zip": "zip / postal code exactly as shown, or null",
  "country": "string or null",
  "virtual_url": "registration/zoom link if virtual, or null",
  "ticket_url": "ticket/registration link or null",
  "ignore": false
}

Set "ignore": true if the page is not actually a single literary event (e.g. an error page, an index page, or a non-literary event like a science conference).

${TIME_RULES}

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
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.warn(`[crawl-calendars] invalid JSON from parser for ${url}:`, e);
              await sleep(delayMs);
              continue;
            }
            if (!event.ignore && event.title) {
              const { error } = await supabase.from("pending_imports").insert({
                source_email: source.sourceEmail,
                source_subject: url,
                raw_body: text.slice(0, 10000),
                parsed_data: {
                  ...event,
                  source_url: url,
                  source_name: source.name,
                },
                status: "pending",
              });
              if (error) {
                console.error(`[crawl-calendars] insert failed for ${url}:`, error.message);
              } else {
                summary[source.name].queued++;
              }
            } else {
              console.warn(`[crawl-calendars] parser skipped ${url} (ignore=${event.ignore ?? "?"}, title=${JSON.stringify(event.title ?? null)})`);
            }
          } else {
            console.warn(`[crawl-calendars] no JSON in parser output for ${url}`);
          }
        }

        await sleep(delayMs);
      }
    } catch (error) {
      // One broken source shouldn't sink the rest of the run
      console.error(`[crawl-calendars] ${source.name} failed:`, error);
    }
  }

  return NextResponse.json({ ok: true, sources: summary });
}
