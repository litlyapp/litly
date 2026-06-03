import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  // Check admin password
  const { input, password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!input?.trim()) {
    return NextResponse.json({ error: "No input provided" }, { status: 400 });
  }

  const prompt = `You are a literary event data extractor for litly, a literary event locator platform.

Extract structured event data from the following text or webpage content. Return ONLY a valid JSON object with these exact fields:

{
  "title": "Event title (string, required)",
  "description": "Event description (string or null)",
  "genre": "One of: poetry, fiction, nonfiction, essay, hybrid_experimental, translation, ya, craft_talk, open_mic, mixed",
  "event_type": "in_person or virtual",
  "date_time": "ISO 8601 datetime string (e.g. 2026-07-15T19:00:00) or null if not found",
  "end_time": "ISO 8601 datetime string or null",
  "location_name": "Venue name (string or null)",
  "address": "Full address (string or null)",
  "virtual_url": "URL for virtual events (string or null)",
  "open_mic": "true or false",
  "featured_readers": "[{name: string, url: string}] or null",
  "rsvp_enabled": "false (always false for imported events)",
  "source_name": "Name of the source website or publication",
  "ignore": "true if this is NOT a literary/book/poetry/writing event, false otherwise"
}

If the event is not related to books, poetry, fiction, writing, publishing, or literary arts, set "ignore": true.

Current year is 2026. If a date mentions a month/day without a year, assume 2026.

Input:
${input}

Return ONLY the JSON object, no other text.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ parsed });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse event" },
      { status: 500 }
    );
  }
}
