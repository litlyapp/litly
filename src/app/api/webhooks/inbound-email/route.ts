import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// Use service role to bypass RLS for inserting pending imports
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const from = formData.get("from")?.toString() ?? "";
    const subject = formData.get("subject")?.toString() ?? "";
    const bodyPlain = formData.get("body-plain")?.toString() ?? "";
    const bodyHtml = formData.get("body-html")?.toString() ?? "";

    const body = bodyPlain || bodyHtml;

    if (!body.trim()) {
      return NextResponse.json({ ok: true, skipped: "empty body" });
    }

    // Parse with Claude Haiku
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a literary event extractor for litly.

Extract ALL literary events from this newsletter email. Return a JSON array of event objects.

Each event object:
{
  "title": "string (required)",
  "description": "string or null",
  "genre": ["array of: poetry, fiction, nonfiction, essay, hybrid_experimental, translation, ya, craft_talk, open_mic"],
  "event_type": "in_person or virtual",
  "date_time": "ISO 8601 or null",
  "end_time": "ISO 8601 or null",
  "location_name": "string or null",
  "address": "string or null",
  "virtual_url": "string or null",
  "ticket_url": "string or null",
  "source_name": "name of the newsletter or org",
  "ignore": false
}

Set "ignore": true for anything that is NOT a literary/book/poetry/writing event.
If no events found, return [].
Return ONLY a valid JSON array, no other text.

Email subject: ${subject}
Email from: ${from}

Email body:
${body.slice(0, 8000)}`,
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
