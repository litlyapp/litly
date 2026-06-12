import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared rules appended to both import-parsing prompts so dates survive the
// timestamptz round-trip: naive wall-clock strings pass through unchanged,
// while offset strings get converted to UTC and shift the displayed time
export const TIME_RULES = `Date/time rules:
- Return date_time and end_time as the event's LOCAL wall-clock time in ISO 8601 format WITHOUT any timezone offset or Z suffix (e.g. "2026-07-15T19:00:00", never "2026-07-15T19:00:00-04:00").
- Set "time_confirmed": true only if the source explicitly states a start time. If only a date is given, use T00:00:00 and set "time_confirmed": false.
- Never invent a time. end_time stays null unless explicitly stated, and must be on the same day or the day after date_time (it is when this occurrence ends, not the end of a multi-week series).
- Current year is 2026. If a date mentions only month/day, assume 2026.`;

export function looksLikeUrl(input: string): boolean {
  return /^https?:\/\/\S+$/i.test(input.trim());
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();
}

// Fetch a page and return its visible text, or null on any failure.
// Best-effort: import parsing should degrade gracefully, never throw.
export async function fetchPageText(url: string, maxChars = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; litly/1.0; +https://thelitlyapp.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtml(html);
    return text ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

export interface KnownVenue {
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

// Most senders are orgs/bookstores with one recurring venue — but some
// (newsletters, aggregators) list events at many venues. Only reuse a venue
// when the source's recent events all share the same address; an aggregator's
// "most recent venue" would stamp wrong addresses on unrelated events.
export async function findKnownVenue(
  supabase: SupabaseClient,
  sourceName: string | null | undefined
): Promise<KnownVenue | null> {
  if (!sourceName?.trim()) return null;
  const { data } = await supabase
    .from("events")
    .select("location_name, address, city, state, country")
    .eq("source_name", sourceName.trim())
    .eq("event_type", "in_person")
    .not("address", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (!data?.length) return null;
  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  const consistent = data.every((v) => norm(v.address) === norm(data[0].address));
  return consistent ? data[0] : null;
}

export interface ParsedImportEvent {
  event_type?: string | null;
  location_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  date_time?: string | null;
  time_confirmed?: boolean;
  source_url?: string | null;
  ticket_url?: string | null;
  venue_filled_from?: string | null;
  [key: string]: unknown;
}

function missingVenue(event: ParsedImportEvent): boolean {
  return (event.event_type ?? "in_person") === "in_person" && (!event.address || !event.city);
}

// Fill missing venue fields from past approved events by the same source
export async function applyKnownVenue(
  supabase: SupabaseClient,
  event: ParsedImportEvent,
  sourceName: string | null | undefined
): Promise<ParsedImportEvent> {
  if (!missingVenue(event)) return event;
  const venue = await findKnownVenue(supabase, sourceName);
  if (!venue) return event;
  return {
    ...event,
    location_name: event.location_name ?? venue.location_name,
    address: event.address ?? venue.address,
    city: event.city ?? venue.city,
    state: event.state ?? venue.state,
    country: event.country ?? venue.country,
    venue_filled_from: "previous events from this source",
  };
}

// Second extraction pass: when an event is missing venue or a confirmed time
// but links to its own page, fetch that page and fill ONLY the gaps.
export async function enrichFromLink(
  anthropic: Anthropic,
  event: ParsedImportEvent
): Promise<ParsedImportEvent> {
  const needsVenue = missingVenue(event);
  const needsTime = !event.date_time || event.time_confirmed === false;
  if (!needsVenue && !needsTime) return event;

  const url = event.source_url || event.ticket_url;
  if (!url || !/^https?:\/\//.test(url)) return event;

  const pageText = await fetchPageText(url, 8000);
  if (!pageText) return event;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Extract ONLY the venue and start time for this event from its webpage. Return ONLY a JSON object:
{
  "location_name": "venue name or null",
  "address": "street address or null",
  "city": "city or null",
  "state": "US state 2-letter code or null",
  "country": "country or null",
  "date_time": "local wall-clock ISO 8601 WITHOUT timezone offset (e.g. 2026-07-15T19:00:00) or null",
  "time_confirmed": "true only if a start time is explicitly stated"
}
Do not guess fields that are not stated on the page. Current year is 2026.

Event title: ${event.title ?? ""}

Webpage content:
${pageText}`,
        },
      ],
    });
    const content = message.content[0];
    if (content.type !== "text") return event;
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return event;
    const found = JSON.parse(jsonMatch[0]);

    const enriched = { ...event };
    if (needsVenue) {
      enriched.location_name = event.location_name ?? found.location_name ?? null;
      enriched.address = event.address ?? found.address ?? null;
      enriched.city = event.city ?? found.city ?? null;
      enriched.state = event.state ?? found.state ?? null;
      enriched.country = event.country ?? found.country ?? null;
    }
    if (needsTime && found.date_time && found.time_confirmed === true) {
      enriched.date_time = found.date_time;
      enriched.time_confirmed = true;
    }
    return enriched;
  } catch {
    return event;
  }
}
