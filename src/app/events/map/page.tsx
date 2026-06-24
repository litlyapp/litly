import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventMap from "@/components/EventMap";
import FiltersSidebar from "@/components/FiltersSidebar";
import ViewToggle from "@/components/ViewToggle";
import { applyEventFilters, type EventFilterParams } from "@/lib/events/filterQuery";

export const dynamic = "force-dynamic";

interface SearchParams extends EventFilterParams {
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

  // Organizer list powers both the filter sidebar and the keyword search
  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, name, avatar_url")
    .order("name");

  // Fetch the full filtered set (both in-person and virtual) so we can report
  // how many matching events exist vs. how many can actually be plotted.
  let query = supabase
    .from("events")
    .select(
      "id, title, genre, event_type, date_time, timezone, lat, lng, location_name, parent_event_id, organizer:organizer_profiles!events_organizer_id_fkey(id, name)"
    )
    .eq("is_cancelled", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  query = applyEventFilters(query, params, organizers ?? []);

  const { data: events } = await query;

  // Deduplicate recurring series: keep only the next upcoming occurrence per series.
  // Events are sorted by date_time asc, so the first seen per series key is correct.
  const seen = new Set<string>();
  const dedupedEvents = (events ?? []).filter((event) => {
    const seriesKey = event.parent_event_id ?? event.id;
    if (seen.has(seriesKey)) return false;
    seen.add(seriesKey);
    return true;
  });

  // Only in-person events with coordinates can be placed on the map.
  const mappableEvents = dedupedEvents.filter(
    (e) => e.event_type === "in_person" && e.lat != null && e.lng != null
  );

  const totalMatching = dedupedEvents.length;
  const mappedCount = mappableEvents.length;
  const hiddenCount = totalMatching - mappedCount;

  const lat = params.lat ? Number(params.lat) : null;
  const lng = params.lng ? Number(params.lng) : null;
  const initialUserLoc =
    lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng) ? { lat, lng } : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-serif text-4xl text-cream mb-1">Event map</h1>
        <p className="text-cream-muted mb-3">
          {mappedCount} mapped {mappedCount === 1 ? "event" : "events"} shown
          {hiddenCount > 0 && (
            <span className="text-cream-muted/70">
              {" "}· {hiddenCount} virtual {hiddenCount === 1 ? "event" : "events"} hidden
            </span>
          )}
        </p>
        <Suspense fallback={null}>
          <ViewToggle active="map" />
        </Suspense>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters — same component as the list view, URL-driven so
            filters carry over between List and Map */}
        <Suspense fallback={<div className="lg:w-64 lg:shrink-0 text-cream-muted text-sm">Loading filters…</div>}>
          <FiltersSidebar organizers={organizers ?? []} hideType />
        </Suspense>

        <div className="flex-1">
          <EventMap events={mappableEvents} initialUserLoc={initialUserLoc} />
        </div>
      </div>
    </div>
  );
}
