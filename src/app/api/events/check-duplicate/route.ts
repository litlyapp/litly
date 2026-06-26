import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Normalize a venue/title string for fuzzy comparison
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Token-set (Jaccard) similarity of two strings, 0..1
function titleSim(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

// Grammatical filler — sharing only these doesn't make two titles "related"
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "nor", "of", "at", "in", "on", "with", "for", "to",
  "by", "from", "into", "onto", "off", "out", "as", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "it", "its", "we", "you", "your", "our", "their", "his",
  "her", "they", "via", "vs", "w",
]);

// True when the titles share at least one meaningful (non-stopword) word
function sharesContentWord(a: string, b: string): boolean {
  const wa = new Set(norm(a).split(" ").filter((w) => w && !STOPWORDS.has(w)));
  const wb = new Set(norm(b).split(" ").filter((w) => w && !STOPWORDS.has(w)));
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

// UTC calendar-day key for same-day comparison
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

type Match = {
  id: string;
  title: string;
  date_time: string;
  timezone: string | null;
  location_name: string | null;
  organizer_name: string;
  strength: "strong" | "soft";
};

// Surfaces events that look like the same real-world event already posted on
// litly — possibly by a different org (e.g. the venue itself). Cross-org by
// design, so we never filter on organizer_id. Non-authoritative: the caller
// shows it as a warning, not a hard block.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const {
    title,
    date_time,
    lat,
    lng,
    location_name,
    zip_code,
    excludeEventId,
  } = (await request.json()) as {
    title?: string;
    date_time?: string;
    lat?: number | null;
    lng?: number | null;
    location_name?: string | null;
    zip_code?: string | null;
    excludeEventId?: string | null;
  };

  if (!title || !date_time) return NextResponse.json({ matches: [] });
  const day = new Date(date_time);
  if (isNaN(day.getTime())) return NextResponse.json({ matches: [] });

  // Pull a ±36h window so timezone drift around the target calendar day can't
  // hide a same-day match; we tighten to an exact day key below.
  const from = new Date(day.getTime() - 36 * 3600 * 1000).toISOString();
  const to = new Date(day.getTime() + 36 * 3600 * 1000).toISOString();

  let query = supabase
    .from("events")
    .select(
      "id, title, date_time, timezone, location_name, lat, lng, zip_code, organizer:organizer_profiles!events_organizer_id_fkey(name)"
    )
    .eq("is_published", true)
    .eq("is_cancelled", false)
    .gte("date_time", from)
    .lte("date_time", to)
    .limit(100);
  if (excludeEventId) query = query.neq("id", excludeEventId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ matches: [], error: error.message });

  const targetDay = dayKey(date_time);
  const matches: Match[] = [];

  for (const e of data ?? []) {
    if (dayKey(e.date_time) !== targetDay) continue;

    // Venue signal: close coordinates, identical venue name, or same zip + a
    // roughly-matching venue name.
    let venueMatch = false;
    if (lat != null && lng != null && e.lat != null && e.lng != null) {
      if (Math.abs(e.lat - lat) < 0.002 && Math.abs(e.lng - lng) < 0.002) venueMatch = true;
    }
    if (!venueMatch && location_name && e.location_name && norm(location_name) === norm(e.location_name)) {
      venueMatch = true;
    }
    if (
      !venueMatch && zip_code && e.zip_code && zip_code.trim() === e.zip_code.trim() &&
      location_name && e.location_name && titleSim(location_name, e.location_name) > 0.4
    ) {
      venueMatch = true;
    }

    const tSim = titleSim(title, e.title);

    // Strong: same day + same venue + similar title.
    // Soft: same venue with *some* shared title word (a venue running two
    // entirely unrelated events the same day is NOT flagged), OR a very similar
    // title without a venue confirmation.
    let strength: "strong" | "soft" | null = null;
    if (venueMatch && tSim >= 0.5) strength = "strong";
    else if (venueMatch && sharesContentWord(title, e.title)) strength = "soft";
    else if (tSim >= 0.7) strength = "soft";
    if (!strength) continue;

    const org = e.organizer as { name?: string } | { name?: string }[] | null;
    const organizer_name = (Array.isArray(org) ? org[0]?.name : org?.name) ?? "another organizer";

    matches.push({
      id: e.id,
      title: e.title,
      date_time: e.date_time,
      timezone: e.timezone,
      location_name: e.location_name,
      organizer_name,
      strength,
    });
  }

  // Strong matches first, capped so the warning stays readable.
  matches.sort((a, b) => Number(b.strength === "strong") - Number(a.strength === "strong"));
  return NextResponse.json({ matches: matches.slice(0, 5) });
}
