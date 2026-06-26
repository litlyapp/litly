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
      // Strip ALL HTML attributes — removes every machine-readable timestamp, offset, and data-*
      // regardless of encoding format or attribute name. Claude sees only tag structure + visible text.
      .replace(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, "<$1>");
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
- date: string | null (date only, YYYY-MM-DD format, e.g. "2026-08-15")
- start_time_display: string | null (time exactly as shown on the page, e.g. "6:00 PM" or "6pm" or "18:00" — copy verbatim, do NOT convert or adjust)
- end_time_display: string | null (end time exactly as shown on the page, same rule)
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

Return ONLY the JSON object, no explanation.

HTML:
${html}`,
      },
    ],
  });

  let extracted: Record<string, unknown>;
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    extracted = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse extracted event data" }, { status: 500 });
  }

  // Convert date + display time string → ISO 8601 local datetime (no offset)
  function buildIso(date: string | null | undefined, timeDisplay: string | null | undefined): string | null {
    if (!date) return null;
    if (!timeDisplay) return `${date}T00:00:00`;
    const t = timeDisplay.trim().toLowerCase();
    // Already HH:MM or HH:MM:SS
    const already = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (already) return `${date}T${already[1].padStart(2,"0")}:${already[2]}:00`;
    // 12-hour: "6:00 pm", "6pm", "6:30am"
    const twelve = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (twelve) {
      let h = parseInt(twelve[1], 10);
      const m = parseInt(twelve[2] ?? "0", 10);
      const meridiem = twelve[3];
      if (meridiem === "pm" && h !== 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      return `${date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
    }
    return null;
  }

  const dateStr = extracted.date as string | null;
  const isoDateTime = buildIso(dateStr, extracted.start_time_display as string | null);
  const isoEndTime = buildIso(dateStr, extracted.end_time_display as string | null);

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
      date_time: isoDateTime,
      timezone: (extracted.timezone as string) ?? null,
      end_time: isoEndTime,
      location_name: (extracted.location_name as string) ?? null,
      address: (extracted.address as string) ?? null,
      city: (extracted.city as string) ?? null,
      state: (extracted.state as string) ?? null,
      country: (extracted.country as string) ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      virtual_url: (extracted.virtual_url as string) || (extracted.event_type !== "virtual" ? url : null),
      ticket_url: (extracted.ticket_url as string) ?? null,
      source_url: url,
      source_name: (() => {
        try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
      })(),
      is_imported: true,
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
