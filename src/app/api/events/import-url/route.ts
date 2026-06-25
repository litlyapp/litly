import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { isSafeUrl } from "@/lib/safeUrl";

const anthropic = new Anthropic();

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // best-effort
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { url, organizerId } = await request.json();
  if (!url || !organizerId) {
    return NextResponse.json({ error: "Missing url or organizerId" }, { status: 400 });
  }

  // Verify user is a member of the org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", organizerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Block SSRF: reject private/internal addresses before fetching
  if (!(await isSafeUrl(url))) {
    return NextResponse.json({ error: "URL is not reachable" }, { status: 422 });
  }

  // Fetch the page — try with a browser-like UA first; some sites block bots
  const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  let html: string;
  try {
    let res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,*/*" },
      signal: AbortSignal.timeout(10000),
    });
    // Fall back to our own UA if the browser UA still fails
    if (!res.ok && res.status !== 403 && res.status !== 401) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!res.ok) {
      res = await fetch(url, {
        headers: { "User-Agent": "litly/1.0 (thelitlyapp.com)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
    html = await res.text();
    // Strip <head>, <script>, <style> blocks to save token budget for actual content
    html = html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remove datetime/content attributes that carry UTC-encoded timestamps.
      // Claude reads these and gets the local time wrong (e.g. 18:00Z → 2 PM EDT instead of 6 PM).
      // Matches: datetime="...", content="2026-..." on <meta> tags, data-* timestamp attrs.
      .replace(/\bdatetime="[^"]*"/gi, "")
      .replace(/(<meta\b[^>]*?)\scontent="20\d\d-\d\d-\d\dT[^"]*"/gi, "$1")
      .replace(/\sdata-[a-z-]*(?:date|time|start|end|unix|utc|ts)[a-z-]*="[^"]*"/gi, "");
    // Trim to 50k chars — Claude doesn't need the full DOM
    html = html.slice(0, 50000);
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch URL: ${err}` }, { status: 422 });
  }

  // Extract event data via Claude Haiku
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract event information from this HTML and return a JSON object with these exact fields. Use null for any field you cannot determine with confidence.

Fields:
- title: string (event name)
- description: string | null (full event description, plain text)
- date_time: string | null (ISO 8601 format WITHOUT timezone offset, e.g. "2026-08-15T19:00:00" — use the human-readable local time shown on the page, NOT any UTC or machine-encoded datetime from schema.org/JSON-LD metadata)
- end_time: string | null (ISO 8601 format without timezone offset, local time as displayed)
- timezone: string | null (IANA timezone, e.g. "America/New_York" — infer from the event location or any timezone label shown on the page)
- event_type: "in_person" | "virtual" (default to "in_person" if unclear)
- location_name: string | null (venue name)
- address: string | null (street address only, no city/state)
- city: string | null
- state: string | null (2-letter US state code if US)
- country: string | null
- ticket_url: string | null (URL to buy tickets or RSVP)
- virtual_url: string | null (URL to join virtual event)
- banner_url: string | null (URL of the main event image if present as an absolute URL)

IMPORTANT: For date_time and end_time, always use the time as it appears to the reader on the page (e.g. "3:00 PM"), never convert from UTC or use raw schema.org datetime values.

Return ONLY the JSON object, no explanation.

HTML:
${html}`,
      },
    ],
  });

  let extracted: Record<string, unknown>;
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip markdown code fences Claude sometimes wraps around JSON
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    extracted = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse extracted event data" }, { status: 500 });
  }

  // Geocode if in-person
  let coords: { lat: number; lng: number } | null = null;
  if (extracted.event_type !== "virtual") {
    const query = [extracted.address, extracted.location_name, extracted.city, extracted.state, extracted.country]
      .filter(Boolean)
      .join(", ");
    if (query) coords = await geocode(query);
  }

  // Insert as unpublished draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (supabase as any)
    .from("events")
    .insert({
      organizer_id: organizerId,
      title: (extracted.title as string) || "Untitled event",
      description: (extracted.description as string) ?? null,
      genre: [],
      event_type: ((extracted.event_type as string) === "virtual" ? "virtual" : "in_person"),
      date_time: (extracted.date_time as string) ?? null,
      timezone: (extracted.timezone as string) ?? null,
      end_time: (extracted.end_time as string) ?? null,
      location_name: (extracted.location_name as string) ?? null,
      address: (extracted.address as string) ?? null,
      city: (extracted.city as string) ?? null,
      state: (extracted.state as string) ?? null,
      country: (extracted.country as string) ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      virtual_url: (extracted.virtual_url as string) ?? null,
      ticket_url: (extracted.ticket_url as string) ?? null,
      banner_url: await (async () => {
        const raw = extracted.banner_url as string | null | undefined;
        if (!raw || !/^https:\/\//i.test(raw)) return null;
        return (await isSafeUrl(raw)) ? raw : null;
      })(),
      open_mic: false,
      rsvp_enabled: false,
      is_published: false,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
