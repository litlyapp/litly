import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import LandingSearch from "@/components/LandingSearch";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  // Grab the next 6 upcoming events as "featured"
  const { data: featuredEvents } = await supabase
    .from("events")
    .select(
      `id, title, description, genre, event_type, date_time, end_time,
       location_name, address, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
       organizer:organizer_profiles(id, name, org_type)`
    )
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true })
    .limit(6);

  // Total upcoming event count for the tagline
  const { count } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .gte("date_time", new Date().toISOString());

  return (
    <div>
      {/* Hero */}
      <section className="relative px-4 pt-20 pb-16 text-center overflow-hidden">
        {/* Decorative blobs */}
        <div
          aria-hidden
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
          style={{ background: "#E8622A", filter: "blur(80px)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full opacity-10"
          style={{ background: "#E8622A", filter: "blur(60px)" }}
        />

        <div className="relative max-w-3xl mx-auto">
          <p className="text-orange text-sm font-medium tracking-widest uppercase mb-4">
            The literary event locator
          </p>
          <h1 className="font-serif text-5xl md:text-7xl text-cream leading-tight mb-6">
            Find your next<br />
            <span className="text-orange italic">literary moment.</span>
          </h1>
          <p className="text-cream-muted text-lg md:text-xl max-w-lg mx-auto mb-10">
            Readings, open mics, craft talks, and more —<br className="hidden sm:block" />
            all in one place.{" "}
            {count != null && count > 0 && (
              <span className="text-cream">
                {count} event{count !== 1 ? "s" : ""} coming up.
              </span>
            )}
          </p>

          {/* Search bar — navigates to /events?q=... */}
          <LandingSearch />

          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/events"
              className="border border-cream/25 text-cream-muted text-sm px-5 py-2 rounded-full hover:border-cream/50 hover:text-cream transition"
            >
              Browse all events
            </Link>
            <Link
              href="/events/map"
              className="border border-cream/25 text-cream-muted text-sm px-5 py-2 rounded-full hover:border-cream/50 hover:text-cream transition"
            >
              View map
            </Link>
            <Link
              href="/register"
              className="border border-cream/25 text-cream-muted text-sm px-5 py-2 rounded-full hover:border-cream/50 hover:text-cream transition"
            >
              Post an event
            </Link>
          </div>
        </div>
      </section>

      {/* Featured events */}
      {featuredEvents && featuredEvents.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-2xl text-cream">Upcoming events</h2>
            <Link
              href="/events"
              className="text-orange text-sm hover:underline underline-offset-2"
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
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
          {[
            { label: "Poetry", value: "poetry" },
            { label: "Fiction", value: "fiction" },
            { label: "Nonfiction", value: "nonfiction" },
            { label: "Essay", value: "essay" },
            { label: "Open Mic", value: "open_mic" },
            { label: "Craft Talk", value: "craft_talk" },
            { label: "Translation", value: "translation" },
            { label: "YA", value: "ya" },
            { label: "Hybrid / Experimental", value: "hybrid_experimental" },
            { label: "Mixed", value: "mixed" },
          ].map((g) => (
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
              Running a reading series?
            </h2>
            <p className="text-cream-muted max-w-md">
              litly is free to post on. Reach readers who are actively looking
              for events like yours.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/register"
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
