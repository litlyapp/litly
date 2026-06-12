import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { stripHtml, applyKnownVenue, enrichFromLink, TIME_RULES } from "@/lib/importParsing";

// Parsing + per-event link enrichment can exceed Vercel's default timeout
export const maxDuration = 60;

const CONFIRMATION_FORWARD_TO = "knuth.cdgo@gmail.com";
const CONFIRMATION_PATTERN = /confirm|verify|activate|subscri|welcome|opt.?in/i;

function verifyMailgunSignature(timestamp: string, token: string, signature: string): boolean {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return false; // reject all requests if key is not configured

  // Reject if timestamp is more than 5 minutes old (replay protection)
  const tsSeconds = parseInt(timestamp, 10);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) return false;

  const value = timestamp + token;
  const expected = createHmac("sha256", signingKey).update(value).digest("hex");
  return expected === signature;
}

async function forwardToGmail(from: string, subject: string, bodyPlain: string, bodyHtml: string) {
  const formData = new FormData();
  formData.append("from", "litly inbound <newsletters@thelitlyapp.com>");
  formData.append("to", CONFIRMATION_FORWARD_TO);
  formData.append("subject", `[litly fwd] ${subject}`);
  formData.append("text", `Originally from: ${from}\n\n${bodyPlain}`);
  if (bodyHtml) formData.append("html", bodyHtml);

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  const res = await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });
  if (!res.ok) {
    console.error("[inbound-email] forwardToGmail failed:", await res.text());
  }
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const formData = await request.formData();

    // Verify Mailgun webhook signature
    const timestamp = formData.get("timestamp")?.toString() ?? "";
    const token = formData.get("token")?.toString() ?? "";
    const signature = formData.get("signature")?.toString() ?? "";
    if (!verifyMailgunSignature(timestamp, token, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const bodyPlain = formData.get("body-plain")?.toString() ?? "";
    const bodyHtml = formData.get("body-html")?.toString() ?? "";

    // Strip markup before any length budgeting — raw HTML newsletters can
    // burn the whole slice on tags before reaching event text
    const body = bodyPlain || stripHtml(bodyHtml);

    // Ignore litly's own outbound mail (RSVP confirmations, digests, alerts)
    // looping back in via the catch-all — e.g. when an admin@thelitlyapp.com
    // account RSVPs to an event
    if (/@thelitlyapp\.com/i.test(from)) {
      return NextResponse.json({ ok: true, skipped: "self-sent email" });
    }

    // Forward confirmation/verification emails to personal inbox
    if (CONFIRMATION_PATTERN.test(subject)) {
      await forwardToGmail(from, subject, bodyPlain, bodyHtml);
    }

    // If body is empty or very short, use subject as content
    const emailContent = body.trim().length > 10 ? body : `Subject: ${subject}`;

    if (!emailContent.trim()) {
      return NextResponse.json({ ok: true, skipped: "empty body" });
    }

    // Parse with Claude Haiku
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a literary event extractor for litly, a platform for literary events.

Extract ALL events from this email that relate to books, poetry, fiction, nonfiction, writing, authors, readings, open mics, craft talks, book releases, or literary arts.

Rules:
- INCLUDE if the email mentions: readings, book releases, open mics, author events, poetry, fiction, writing workshops, craft talks, literary festivals, or bookstore events.
- IGNORE only if the email is clearly spam, a generic store sale, a non-literary event (sports, food, music with no literary connection), or completely unrelated to books/writing/authors.
- When in doubt, INCLUDE with null fields rather than ignore. The curator will fill in missing details.

Return a JSON array of event objects. Each object:
{
  "title": "Event title — use email subject if no better title found",
  "description": "string or null",
  "genre": ["array of applicable: poetry, fiction, nonfiction, essay, translation, ya, craft_talk, open_mic, workshop, in_conversation, slam, other (use other only when clearly literary but nothing else fits)"],
  "event_type": "in_person or virtual (default to in_person if unclear)",
  "date_time": "ISO 8601 or null",
  "end_time": "ISO 8601 or null",
  "time_confirmed": "true only if the email explicitly states a start time, false otherwise",
  "location_name": "string or null",
  "address": "string or null",
  "city": "string or null",
  "state": "string or null",
  "country": "string or null",
  "virtual_url": "string or null",
  "ticket_url": "string or null",
  "source_url": "link to the event's own webpage if the email contains one, or null",
  "source_name": "name of the sender org or newsletter",
  "ignore": false
}

${TIME_RULES}
If truly no literary event can be identified, return [].
Return ONLY a valid JSON array, no other text.

Email subject: ${subject}
Email from: ${from}

Email body:
${emailContent.slice(0, 12000)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // No events found — still log the email
      await supabase.from("pending_imports").insert({
        source_email: from,
        source_subject: subject,
        raw_body: body.slice(0, 10000),
        parsed_data: null,
        status: "pending",
      });
      return NextResponse.json({ ok: true, events: 0 });
    }

    const events = JSON.parse(jsonMatch[0]);
    const validEvents = events.filter((e: { ignore?: boolean }) => !e.ignore);

    // Fill gaps so queue items arrive approve-ready: first from this source's
    // past venues, then (capped, best-effort) from the event's own webpage
    let enrichmentBudget = 3;
    for (let i = 0; i < validEvents.length; i++) {
      let event = await applyKnownVenue(supabase, validEvents[i], validEvents[i].source_name);
      const sparse =
        ((event.event_type ?? "in_person") === "in_person" && (!event.address || !event.city)) ||
        !event.date_time ||
        event.time_confirmed === false;
      if (sparse && enrichmentBudget > 0) {
        enrichmentBudget--;
        event = await enrichFromLink(anthropic, event);
      }
      validEvents[i] = event;
    }

    // Insert each parsed event as a separate pending import
    for (const event of validEvents) {
      await supabase.from("pending_imports").insert({
        source_email: from,
        source_subject: subject,
        raw_body: body.slice(0, 10000),
        parsed_data: event,
        status: "pending",
      });
    }

    return NextResponse.json({ ok: true, events: validEvents.length });
  } catch (error) {
    console.error("Inbound email webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
