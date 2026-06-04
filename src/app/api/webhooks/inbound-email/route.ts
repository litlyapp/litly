import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const CONFIRMATION_FORWARD_TO = "knuth.cdgo@gmail.com";
const CONFIRMATION_PATTERN = /confirm|verify|activate|subscri|welcome|opt.?in/i;

async function forwardToGmail(from: string, subject: string, bodyPlain: string, bodyHtml: string) {
  const formData = new FormData();
  formData.append("from", "litly inbound <newsletters@thelitlyapp.com>");
  formData.append("to", CONFIRMATION_FORWARD_TO);
  formData.append("subject", `[litly fwd] ${subject}`);
  formData.append("text", `Originally from: ${from}\n\n${bodyPlain}`);
  if (bodyHtml) formData.append("html", bodyHtml);

  const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
  await fetch("https://api.mailgun.net/v3/thelitlyapp.com/messages", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: formData,
  });
}

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const formData = await request.formData();

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const bodyPlain = formData.get("body-plain")?.toString() ?? "";
    const bodyHtml = formData.get("body-html")?.toString() ?? "";

    const body = bodyPlain || bodyHtml;

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
      max_tokens: 2048,
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
  "genre": ["array of applicable: poetry, fiction, nonfiction, essay, hybrid_experimental, translation, ya, craft_talk, open_mic, workshop"],
  "event_type": "in_person or virtual (default to in_person if unclear)",
  "date_time": "ISO 8601 or null",
  "end_time": "ISO 8601 or null",
  "location_name": "string or null",
  "address": "string or null",
  "city": "string or null",
  "country": "string or null",
  "virtual_url": "string or null",
  "ticket_url": "string or null",
  "source_name": "name of the sender org or newsletter",
  "ignore": false
}

Current year is 2026. If a date mentions only month/day, assume 2026.
If truly no literary event can be identified, return [].
Return ONLY a valid JSON array, no other text.

Email subject: ${subject}
Email from: ${from}

Email body:
${emailContent.slice(0, 8000)}`,
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
