import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rateLimit";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`admin:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

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
  "genre": ["array of applicable genres — pick all that apply from: poetry, fiction, nonfiction, essay, translation, ya, craft_talk, open_mic, workshop, in_conversation, slam"],
  "event_type": "in_person or virtual",
  "date_time": "ISO 8601 datetime string (e.g. 2026-07-15T19:00:00) or null if not found",
  "end_time": "ISO 8601 datetime string or null",
  "location_name": "Venue name (string or null)",
  "address": "Full street address (string or null)",
  "city": "City name parsed directly from the address/venue text — do not guess or infer one that isn't stated (string or null)",
  "state": "US state as a 2-letter code (e.g. CA, NY) parsed directly from the address — do not guess (string or null)",
  "country": "Country name parsed directly from the address. If a US state/zip code is present, this MUST be 'United States' — never infer a different country from city/street names that happen to resemble place names elsewhere in the world (string or null)",
  "virtual_url": "URL for virtual events (string or null)",
  "open_mic": "true if open_mic is in the genre array, false otherwise",
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
