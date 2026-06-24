import type ical from "node-ical";
import type { Genre, EventType } from "@/types/database";

export interface ParsedFeedEvent {
  uid: string;
  title: string;
  description: string | null;
  // Naive wall-clock ISO (no offset) if the VEVENT was a floating/local time,
  // otherwise a true UTC instant ISO string.
  date_time: string;
  end_time: string | null;
  timezone: string | null;
  location_name: string | null;
  url: string | null;
}

// node-ical's VEVENT.start carries a `tz` property (IANA name) when the
// source used a floating/local DTSTART with a TZID; UTC/Z-suffixed values
// have no tz and convert cleanly via toISOString().
function startToFields(start: ical.DateWithTimeZone): { date_time: string; timezone: string | null } {
  const tz = start.tz;
  if (tz) {
    // start is already a JS Date representing the correct instant; for a
    // floating local time, format its wall-clock fields directly instead of
    // converting to UTC, matching the rest of the app's "naive local time"
    // convention (see TIME_RULES in importParsing.ts).
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = dtf.formatToParts(start).reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return {
      date_time: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`,
      timezone: tz,
    };
  }
  return { date_time: start.toISOString(), timezone: null };
}

export async function parseFeed(url: string): Promise<ParsedFeedEvent[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "litlybot/1.0 (+https://thelitlyapp.com; calendar sync; contact: support@thelitlyapp.com)",
    },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  const body = await res.text();
  const { sync } = await import("node-ical");
  const data = sync.parseICS(body);

  const events: ParsedFeedEvent[] = [];
  for (const raw of Object.values(data)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const item: ical.VEvent = raw;
    if (!item.uid || !item.summary || !item.start) continue;
    if (item.status === "CANCELLED") continue;

    const { date_time, timezone } = startToFields(item.start);
    const end_time = item.end ? startToFields(item.end).date_time : null;

    events.push({
      uid: String(item.uid),
      title: String(item.summary).trim(),
      description: item.description ? String(item.description).trim() : null,
      date_time,
      end_time,
      timezone,
      location_name: item.location ? String(item.location).trim() : null,
      url: item.url ? String(item.url).trim() : null,
    });
  }
  return events;
}

export interface MapToEventRowOptions {
  organizerId: string;
  defaultGenre: Genre[];
  coords: { lat: number; lng: number } | null;
}

export function mapToEventRow(parsed: ParsedFeedEvent, opts: MapToEventRowOptions) {
  const event_type: EventType = parsed.location_name ? "in_person" : "virtual";

  return {
    organizer_id: opts.organizerId,
    feed_source_organizer_id: opts.organizerId,
    external_uid: parsed.uid,
    title: parsed.title,
    description: parsed.description,
    genre: opts.defaultGenre,
    event_type,
    date_time: parsed.date_time,
    end_time: parsed.end_time,
    timezone: parsed.timezone,
    location_name: event_type === "in_person" ? parsed.location_name : null,
    virtual_url: event_type === "virtual" ? parsed.url : null,
    ticket_url: event_type === "in_person" ? parsed.url : null,
    lat: opts.coords?.lat ?? null,
    lng: opts.coords?.lng ?? null,
    is_imported: true,
    source_name: "org calendar feed",
    is_cancelled: false,
  };
}
