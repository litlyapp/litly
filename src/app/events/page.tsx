import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import EventFilters from "@/components/EventFilters";
import { GENRES } from "@/lib/genres";
import type { Genre, EventType } from "@/types/database";

interface SearchParams {
  q?: string;
  genre?: string | string[];
  type?: string;
  from?: string;
  to?: string;
  organizer?: string;
  location?: string;
}

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Fetch all organizer profiles for the dropdown
  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .order("name");

  // Build events query
  let query = supabase
    .from("events")
    .select(
      `
      id, title, description, genre, event_type, date_time, timezone, end_time,
      location_name, address, city, state, country, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
      is_cancelled, parent_event_id,
      organizer:organizer_profiles(id, name, org_type)
    `
    )
    .eq("is_cancelled", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }

  const genres = params.genre
    ? Array.isArray(params.genre)
      ? params.genre
      : [params.genre]
    : [];
  if (genres.length > 0) {
    // Use overlap operator: events whose genre array contains any of the selected genres
    query = query.overlaps("genre", genres as Genre[]);
  }

  if (params.type && params.type !== "all") {
    query = query.eq("event_type", params.type as EventType);
  }

  if (params.from) {
    query = query.gte("date_time", new Date(params.from).toISOString());
  }

  if (params.to) {
    const toDate = new Date(params.to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte("date_time", toDate.toISOString());
  }

  if (params.organizer) {
    query = query.eq("organizer_id", params.organizer);
  }

  if (params.location) {
    const loc = params.location.split(",")[0].trim(); // use city portion
    query = query.or(`city.ilike.%${loc}%,address.ilike.%${loc}%`);
  }

  const { data: rawEvents } = await query;

  // Fetch the logged-in user's saved event IDs and organizer status
  const { data: { user } } = await supabase.auth.getUser();
  let savedEventIds = new Set<string>();
  let isOrganizer = false;
  if (user) {
    const [savedResult, profileResult] = await Promise.all([
      supabase.from("saved_events").select("event_id").eq("user_id", user.id),
      supabase.from("organizer_profiles").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    savedEventIds = new Set((savedResult.data ?? []).map((s) => s.event_id));
    isOrganizer = !!profileResult.data;
  }

  // Deduplicate recurring series: keep only the next upcoming occurrence per series.
  // Events are sorted by date_time asc, so the first seen per series key is already correct.
  const seen = new Set<string>();
  const events = (rawEvents ?? []).filter((event) => {
    const seriesKey = (event as typeof event & { parent_event_id?: string | null }).parent_event_id ?? event.id;
    if (seen.has(seriesKey)) return false;
    seen.add(seriesKey);
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-cream mb-1">Events</h1>
          <p className="text-cream-muted">
            {events?.length ?? 0} upcoming{" "}
            {events?.length === 1 ? "event" : "events"}
          </p>
        </div>
        {isOrganizer && (
          <Link
            href="/events/new"
            className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
          >
            + New event
          </Link>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-64 shrink-0">
          <Suspense fallback={<div className="text-cream-muted text-sm">Loading filters…</div>}>
            <EventFilters organizers={organizers ?? []} />
          </Suspense>
        </aside>

        {/* Event grid */}
        <div className="flex-1">
          {!events || events.length === 0 ? (
            <div className="bg-navy-light rounded-2xl border border-cream/10 p-10 text-center">
              <p className="font-serif text-2xl text-cream mb-2">No events found</p>
              <p className="text-cream-muted text-sm mb-6">
                {params.q
                  ? `No results for "${params.q}"${params.location ? ` in ${params.location}` : ""}.`
                  : params.location
                  ? `No upcoming events in ${params.location}.`
                  : "No events match your current filters."}
              </p>

              <Link
                href="/events"
                className="inline-block mb-8 px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition"
              >
                Clear all filters
              </Link>

              <div>
                <p className="text-cream-muted text-xs uppercase tracking-wider mb-3">Browse by genre</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {GENRES.map((g) => (
                    <Link
                      key={g.value}
                      href={`/events?genre=${g.value}`}
                      className="px-3 py-1 rounded-full text-sm border border-cream/20 text-cream-muted hover:border-orange hover:text-orange transition"
                    >
                      {g.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} savedEventIds={savedEventIds} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
