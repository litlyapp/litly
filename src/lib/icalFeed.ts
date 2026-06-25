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

const DEFAULT_FEED_TZ = "America/New_York";

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;
const SELF_HOSTS = ["thelitlyapp.com", "litly.app"];

// Meeting/join links — only valid for virtual events, never for in-person ticket links
const MEETING_LINK_PATTERNS = [
  /zoom\.us\/j\//i,
  /meet\.google\.com\//i,
  /teams\.microsoft\.com\//i,
  /whereby\.com\//i,
  /webex\.com\//i,
  /streamyard\.com\//i,
  /youtube\.com\/live\//i,
  /youtu\.be\//i,
  /youtube\.com\/watch/i,
];

export function isMeetingLink(url: string): boolean {
  return MEETING_LINK_PATTERNS.some((p) => p.test(url));
}

// Higher score = more likely to be the event/ticket/join link
const URL_PRIORITY: { pattern: RegExp; score: number }[] = [
  // Virtual meeting links
  { pattern: /zoom\.us\/j\//i, score: 100 },
  { pattern: /meet\.google\.com\//i, score: 100 },
  { pattern: /teams\.microsoft\.com\//i, score: 100 },
  { pattern: /whereby\.com\//i, score: 100 },
  { pattern: /webex\.com\//i, score: 100 },
  { pattern: /streamyard\.com\//i, score: 90 },
  { pattern: /youtube\.com\/live\//i, score: 90 },
  { pattern: /youtu\.be\//i, score: 80 },
  { pattern: /youtube\.com\/watch/i, score: 80 },
  // Ticketing / registration platforms
  { pattern: /eventbrite\.com\//i, score: 95 },
  { pattern: /ticketmaster\.com\//i, score: 95 },
  { pattern: /etix\.com\//i, score: 95 },
  { pattern: /universe\.com\//i, score: 90 },
  { pattern: /tito\.io\//i, score: 90 },
  { pattern: /eventbee\.com\//i, score: 90 },
  { pattern: /humanitix\.com\//i, score: 90 },
  { pattern: /squareup\.com\//i, score: 85 },
  { pattern: /forms\.gle\//i, score: 80 },
  { pattern: /docs\.google\.com\/forms/i, score: 80 },
  { pattern: /lu\.ma\//i, score: 85 },
  { pattern: /partiful\.com\//i, score: 85 },
];

function scoreUrl(url: string, orgHost: string | null): number {
  // Known event/ticket/meeting platforms always win
  for (const { pattern, score } of URL_PRIORITY) {
    if (pattern.test(url)) return score;
  }
  // Org's own domain: score by path depth — specific event pages rank higher
  // than the bare homepage, but never above a known platform
  if (orgHost) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === orgHost || parsed.hostname.endsWith(`.${orgHost}`)) {
        const pathSegments = parsed.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean);
        // homepage (no path) = 5, each path segment adds 10, cap at 50
        return Math.min(5 + pathSegments.length * 10, 50);
      }
    } catch { /* ignore malformed URLs */ }
  }
  // Unknown generic URL — usable but lowest priority
  return 1;
}

function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_REGEX)]
    .map((m) => m[0].replace(/[.,;:!?]+$/, ""))
    .filter((u) => !SELF_HOSTS.some((h) => u.includes(h)));
}

function orgHostname(website: string | null): string | null {
  if (!website) return null;
  try {
    return new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}

async function testUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok || (res.status >= 300 && res.status < 400);
  } catch {
    return false;
  }
}

async function resolveEventUrl(
  item: { url?: string; description?: string },
  orgWebsite: string | null
): Promise<string | null> {
  if (item.url) return String(item.url).trim();
  if (!item.description) return null;
  const host = orgHostname(orgWebsite);
  const candidates = extractUrls(String(item.description))
    .sort((a, b) => scoreUrl(b, host) - scoreUrl(a, host));
  for (const url of candidates) {
    if (await testUrl(url)) return url;
  }
  return null;
}

// node-ical's VEVENT.start carries a `tz` property (IANA name) when the
// source used a floating/local DTSTART with a TZID. UTC/Z-suffixed values
// have no tz — those are true UTC instants, so the app's display layer
// (formatDate.ts) needs a real `timezone` value to convert them correctly;
// leaving timezone null makes it treat the UTC clock digits as literal local
// time, which is wrong by the UTC offset (e.g. 10pm UTC shown as "10pm").
// `calendarTz` (the feed's X-WR-TIMEZONE, falling back to DEFAULT_FEED_TZ) is
// the display zone for any event lacking its own TZID.
function startToFields(
  start: ical.DateWithTimeZone,
  calendarTz: string
): { date_time: string; timezone: string | null } {
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
  return { date_time: start.toISOString(), timezone: calendarTz };
}

export async function parseFeed(url: string, orgWebsite?: string | null): Promise<ParsedFeedEvent[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "litlybot/1.0 (+https://thelitlyapp.com; calendar sync; contact: support@thelitlyapp.com)",
    },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  const body = await res.text();
  const { sync } = await import("node-ical");
  const data = sync.parseICS(body);

  const vcalendar = Object.values(data).find((v) => v?.type === "VCALENDAR") as
    | { "WR-TIMEZONE"?: string }
    | undefined;
  const calendarTz = vcalendar?.["WR-TIMEZONE"] || DEFAULT_FEED_TZ;

  const events: ParsedFeedEvent[] = [];
  for (const raw of Object.values(data)) {
    if (!raw || raw.type !== "VEVENT") continue;
    const item: ical.VEvent = raw;
    if (!item.uid || !item.summary || !item.start) continue;
    if (item.status === "CANCELLED") continue;

    const { date_time, timezone } = startToFields(item.start, calendarTz);
    const end_time = item.end ? startToFields(item.end, calendarTz).date_time : null;
    const resolvedUrl = await resolveEventUrl(item, orgWebsite ?? null);

    events.push({
      uid: String(item.uid),
      title: String(item.summary).trim(),
      description: item.description ? String(item.description).trim() : null,
      date_time,
      end_time,
      timezone,
      location_name: item.location ? String(item.location).trim() : null,
      url: resolvedUrl,
    });
  }
  return events;
}

export interface MapToEventRowOptions {
  organizerId: string;
  defaultGenre: Genre[];
  defaultBannerUrl: string | null;
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
    // Only include these keys when the feed actually has a URL — omitting
    // the key (vs. setting it to null) means the upsert's ON CONFLICT DO
    // UPDATE never touches the column, so a ticket/join link the org added
    // manually on Litly survives the next day's resync instead of getting
    // reset to null.
    ...(event_type === "virtual" && parsed.url ? { virtual_url: parsed.url } : {}),
    ...(event_type === "in_person" && parsed.url && !isMeetingLink(parsed.url) ? { ticket_url: parsed.url } : {}),
    lat: opts.coords?.lat ?? null,
    lng: opts.coords?.lng ?? null,
    is_imported: true,
    source_name: "org calendar feed",
    is_cancelled: false,
  };
}
