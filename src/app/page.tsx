import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import LandingSearch from "@/components/LandingSearch";
import InstallButton from "@/components/InstallButton";
import { GENRES } from "@/lib/genres";

export const dynamic = "force-dynamic";

function MapPinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

export default async function HomePage() {
  const supabase = await createClient();

  // Grab the next 6 upcoming events as "featured". Query all occurrences
  // (including recurring children) so series with a past parent date but
  // future children are not silently dropped. Deduplicate by series keeping
  // only the earliest upcoming occurrence per series.
  const { data: featuredRaw } = await supabase
    .from("events")
    .select(
      `id, title, description, genre, event_type, date_time, timezone, end_time,
       location_name, address, city, state, country, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
       parent_event_id,
       organizer:organizer_profiles!events_organizer_id_fkey(id, name, org_type)`
    )
    .eq("is_cancelled", false)
    .neq("is_published", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true })
    .limit(60);

  const seenFeatured = new Set<string>();
  const featuredEvents = [];
  for (const e of featuredRaw ?? []) {
    const key = (e as typeof e & { parent_event_id?: string | null }).parent_event_id ?? e.id;
    if (seenFeatured.has(key)) continue;
    seenFeatured.add(key);
    featuredEvents.push(e);
    if (featuredEvents.length === 6) break;
  }

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

  // Total upcoming event count for the tagline.
  // Match the events page: fetch upcoming non-cancelled events (including
  // recurring children), then dedupe by series so each series counts once.
  const { data: countRows } = await supabase
    .from("events")
    .select("id, parent_event_id")
    .eq("is_cancelled", false)
    .neq("is_published", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });

  const seenSeries = new Set<string>();
  let count = 0;
  for (const row of countRows ?? []) {
    const seriesKey = (row as { parent_event_id?: string | null }).parent_event_id ?? row.id;
    if (seenSeries.has(seriesKey)) continue;
    seenSeries.add(seriesKey);
    count++;
  }

  return (
    <div>
      {/* Hero */}
      <section className="relative px-4 pt-20 pb-16 text-center">
        {/* Decorative blobs */}
        <div
          aria-hidden
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: "#E8622A", filter: "blur(80px)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: "#E8622A", filter: "blur(80px)" }}
        />

        <div className="relative max-w-3xl mx-auto">
          <p className="text-orange text-sm font-medium tracking-widest uppercase mb-4">
            The literary event locator
          </p>
          <h1 className="font-serif text-5xl md:text-7xl text-cream leading-tight mb-6">
            Find your next<br />
            <span className="text-orange italic">literary moment.</span>
          </h1>
          <p className="text-cream-muted text-lg md:text-xl max-w-lg mx-auto mb-2">
            Readings, open mics, craft talks, and more —<br className="hidden sm:block" />
            all in one place.
          </p>
          <div className="mb-10" />

          {/* Search bar — navigates to /events?q=... */}
          <LandingSearch />

          <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
            <Link
              href="/events/map"
              className="inline-flex items-center gap-2 border border-cream/25 text-cream px-5 py-2.5 rounded-full text-sm font-medium hover:border-orange hover:text-orange transition"
            >
              <MapPinIcon />
              Explore the map
            </Link>
          </div>

          <div className="flex justify-center mt-6">
            <InstallButton variant="hero" />
          </div>
        </div>
      </section>

      {/* Featured events */}
      {featuredEvents && featuredEvents.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl text-cream">
              Upcoming events
              {count != null && count > 0 && (
                <span className="ml-2 font-sans text-base text-cream-muted font-normal">
                  ({count})
                </span>
              )}
            </h2>
            <Link
              href="/events"
              className="text-orange text-sm hover:underline underline-offset-2"
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.map((event) => (
              <EventCard key={event.id} event={event} savedEventIds={savedEventIds} />
            ))}
          </div>

          {/* Explore map CTA — mobile only */}
          <div className="md:hidden mt-6">
            <Link
              href="/events/map"
              className="block w-full text-center bg-orange text-cream font-semibold px-6 py-3.5 rounded-full hover:bg-orange/90 transition"
            >
              Explore the map
            </Link>
          </div>
        </section>
      )}

      {/* Empty state — no events yet */}
      {(!featuredEvents || featuredEvents.length === 0) && (
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="bg-navy-light border border-cream/10 rounded-2xl p-16 text-center">
            <p className="font-serif text-2xl text-cream mb-3">
              No events posted yet.
            </p>
            <p className="text-cream-muted text-sm mb-6 max-w-xs mx-auto">
              Be the first to list a reading or literary event on litly.
            </p>
            <Link
              href="/register"
              className="inline-block bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
            >
              Create an organizer account
            </Link>
          </div>
        </section>
      )}

      {/* Genre quick-links */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="font-serif text-2xl text-cream mb-6">Browse by genre</h2>
        <div className="flex flex-wrap gap-3">
          {GENRES.map((g) => (
            <Link
              key={g.value}
              href={`/events?genre=${g.value}`}
              className="px-4 py-2 rounded-full border border-cream/20 text-cream-muted text-sm hover:border-orange hover:text-orange transition"
            >
              {g.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Organizer CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-10 md:p-14 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div>
            <h2 className="font-serif text-3xl text-cream mb-3">
              Hosting an event?
            </h2>
            <p className="text-cream-muted max-w-md">
              Posting on litly is free. Reach readers who are actively looking
              for events like yours.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href={isOrganizer ? "/events/new" : user ? "/become-organizer" : "/register"}
              className="bg-orange text-cream font-semibold px-6 py-3 rounded-full hover:bg-orange/90 transition whitespace-nowrap"
            >
              Post an event
            </Link>
            <Link
              href="/events"
              className="border border-cream/25 text-cream px-6 py-3 rounded-full hover:border-cream/50 transition whitespace-nowrap"
            >
              Browse first
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
