import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import EventFilters from "@/components/EventFilters";
import type { Genre, EventType } from "@/types/database";

interface SearchParams {
  q?: string;
  genre?: string | string[];
  type?: string;
  from?: string;
  to?: string;
  open_mic?: string;
  organizer?: string;
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
      id, title, description, genre, event_type, date_time, end_time,
      location_name, address, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
      organizer:organizer_profiles(id, name, org_type)
    `
    )
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
    query = query.in("genre", genres as Genre[]);
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

  if (params.open_mic === "1") {
    query = query.eq("open_mic", true);
  }

  if (params.organizer) {
    query = query.eq("organizer_id", params.organizer);
  }

  const { data: events } = await query;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Events</h1>
        <p className="text-cream-muted">
          {events?.length ?? 0} upcoming{" "}
          {events?.length === 1 ? "event" : "events"}
        </p>
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
            <div className="bg-navy-light rounded-2xl border border-cream/10 p-16 text-center">
              <p className="font-serif text-2xl text-cream mb-2">
                No events found
              </p>
              <p className="text-cream-muted text-sm">
                Try adjusting your filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
