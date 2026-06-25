import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import FiltersSidebar from "@/components/FiltersSidebar";
import { GENRES } from "@/lib/genres";
import { applyEventFilters } from "@/lib/events/filterQuery";
import ViewToggle from "@/components/ViewToggle";

interface SearchParams {
  q?: string;
  genre?: string | string[];
  type?: string;
  from?: string;
  to?: string;
  organizer?: string;
  location?: string;
  ref?: string;
}

export const dynamic = "force-dynamic";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // When the patron arrived from a calendar day, "clear filters" should send
  // them back to the calendar (at that month) rather than the main list.
  const fromCalendar = params.ref === "calendar";
  const calMonth = params.from?.slice(0, 7); // YYYY-MM from the clicked day
  const clearHref = fromCalendar
    ? `/events/calendar${calMonth ? `?month=${calMonth}` : ""}`
    : "/events";

  // Fetch all organizer profiles for the dropdown
  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, name, avatar_url")
    .order("name");

  // A single-day view (calendar day-click) needs to match the calendar grid's
  // own per-event-timezone day bucketing, not a UTC day boundary — an evening
  // Eastern Time event can fall on the next UTC day. So for this case, widen
  // the query window by a day on each side and do the exact day match in JS
  // using the same logic the calendar grid uses to bucket counts.
  const isSingleDayView = !!params.from && params.from === params.to;
  const queryParams = isSingleDayView ? { ...params, from: undefined, to: undefined } : params;

  // Build events query
  let query = supabase
    .from("events")
    .select(
      `
      id, title, description, genre, event_type, date_time, timezone, end_time,
      location_name, address, city, state, country, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
      is_cancelled, parent_event_id, is_imported, source_url, source_name,
      organizer:organizer_profiles!events_organizer_id_fkey(id, name, org_type)
    `
    )
    .eq("is_cancelled", false)
    .neq("is_published", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  if (isSingleDayView && params.from) {
    const dayStart = new Date(params.from);
    dayStart.setUTCDate(dayStart.getUTCDate() - 1);
    const dayEnd = new Date(params.from);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 2);
    query = query.gte("date_time", dayStart.toISOString()).lt("date_time", dayEnd.toISOString());
  }

  query = applyEventFilters(query, queryParams, organizers ?? []);

  const { data: rawEvents } = await query;

  // For a single-day view, narrow down to events whose own-timezone day
  // actually matches the clicked day (same dayKey logic as the calendar grid).
  const dayFilteredEvents =
    isSingleDayView && params.from
      ? (rawEvents ?? []).filter(
          (e) =>
            new Date(e.date_time).toLocaleDateString("en-CA", {
              timeZone: e.timezone || "America/New_York",
            }) === params.from
        )
      : rawEvents;

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
  // Skip this when viewing a single specific day (e.g. a calendar day-click) —
  // every occurrence that actually falls on that day is relevant, not just the
  // series' next-upcoming instance.
  const seen = new Set<string>();
  const events = isSingleDayView
    ? dayFilteredEvents ?? []
    : (dayFilteredEvents ?? []).filter((event) => {
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
          <p className="text-cream-muted mb-3">
            {events?.length ?? 0} upcoming{" "}
            {events?.length === 1 ? "event" : "events"}
          </p>
          <Suspense fallback={null}>
            <ViewToggle active="list" />
          </Suspense>
        </div>
        {isOrganizer ? (
          <Link
            href="/events/new"
            className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
          >
            + New event
          </Link>
        ) : !user ? (
          <Link
            href="/register"
            className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
          >
            Post an event
          </Link>
        ) : null}
      </div>

      {/* Mobile-only "no results" banner — shown above filters so it's visible
          without scrolling, since the full empty state is below the filters
          on small screens */}
      {(!events || events.length === 0) && (
        <div className="lg:hidden mb-4 bg-orange/10 border border-orange/30 rounded-2xl p-4 text-center">
          <p className="text-cream text-sm font-medium mb-1">No events found</p>
          <p className="text-cream-muted text-xs">
            {params.q
              ? `No results for "${params.q}"${params.location ? ` in ${params.location}` : ""}.`
              : params.location
              ? `No upcoming events in ${params.location}. Try broadening your search.`
              : "No events match your current filters. Try broadening your search."}
          </p>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <Suspense fallback={<div className="lg:w-64 lg:shrink-0 text-cream-muted text-sm">Loading filters…</div>}>
          <FiltersSidebar
            organizers={organizers ?? []}
            clearHref={fromCalendar ? clearHref : undefined}
          />
        </Suspense>

        {/* Event grid */}
        <div className="flex-1">
          {/* Organizer profile banner */}
          {params.organizer && (() => {
            const org = (organizers ?? []).find((o) => o.id === params.organizer);
            const avatarUrl = org?.avatar_url;
            if (!org) return null;
            return (
              <Link
                href={`/organizers/${org.id}`}
                className="flex items-center gap-4 bg-navy-light border border-cream/10 rounded-2xl px-5 py-4 mb-6 hover:border-orange/40 transition group"
              >
                <div className="relative w-12 h-12 shrink-0">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={org.name} fill className="rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange/20 flex items-center justify-center text-orange font-sans text-xl">
                      {org.name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-cream font-medium truncate">{org.name}</p>
                  <p className="text-cream-muted text-xs">View organizer profile</p>
                </div>
                <span className="text-orange text-sm group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            );
          })()}

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
                href={clearHref}
                className="inline-block mb-8 px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition"
              >
                {fromCalendar ? "Back to calendar" : "Clear all filters"}
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
