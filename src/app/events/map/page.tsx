import { createClient } from "@/lib/supabase/server";
import EventMap from "@/components/EventMap";

export const dynamic = "force-dynamic";

interface SearchParams {
  lat?: string;
  lng?: string;
}

export default async function EventMapPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, title, genre, event_type, date_time, timezone, lat, lng, location_name, parent_event_id, organizer:organizer_profiles(id, name)"
    )
    .eq("event_type", "in_person")
    .eq("is_cancelled", false)
    .gte("date_time", new Date().toISOString())
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("date_time", { ascending: true });

  // Deduplicate recurring series: keep only the next upcoming occurrence per series.
  // Events are sorted by date_time asc, so the first seen per series key is already correct.
  const seen = new Set<string>();
  const dedupedEvents = (events ?? []).filter((event) => {
    const seriesKey = (event as typeof event & { parent_event_id?: string | null }).parent_event_id ?? event.id;
    if (seen.has(seriesKey)) return false;
    seen.add(seriesKey);
    return true;
  });

  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;
  const initialUserLoc =
    lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng) ? { lat, lng } : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-serif text-4xl text-cream mb-1">Event map</h1>
        <p className="text-cream-muted">In-person events near you.</p>
      </div>
      <EventMap events={dedupedEvents} initialUserLoc={initialUserLoc} />
    </div>
  );
}
