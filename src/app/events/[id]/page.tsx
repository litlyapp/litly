import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Genre } from "@/types/database";
import { GENRE_LABELS } from "@/lib/genres";
import SaveButton from "@/components/SaveButton";
import RsvpButton from "@/components/RsvpButton";
import AddToCalendarButton from "@/components/AddToCalendarButton";
import EventCard from "@/components/EventCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("title, description, banner_url, location_name, city, state")
    .eq("id", id)
    .single();

  if (!event) return {};

  const location = [event.location_name, event.city, event.state].filter(Boolean).join(", ");
  const description = event.description
    ? event.description.slice(0, 160)
    : location
    ? `A literary event at ${location}.`
    : "A literary event on litly.";

  const images = event.banner_url
    ? [{ url: event.banner_url, width: 1200, height: 630, alt: event.title }]
    : [{ url: "https://thelitlyapp.com/icons/icon-192x192.png", width: 192, height: 192, alt: "litly" }];

  return {
    title: `${event.title} — litly`,
    description,
    openGraph: {
      title: event.title,
      description,
      url: `https://thelitlyapp.com/events/${id}`,
      siteName: "litly",
      images,
      type: "website",
    },
    twitter: {
      card: event.banner_url ? "summary_large_image" : "summary",
      title: event.title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      `
      *,
      organizer:organizer_profiles(id, name, org_type, bio, website, social_links, avatar_url)
    `
    )
    .eq("id", id)
    .single();

  if (!event) notFound();

  // Fetch nearby events if this event has coordinates (~50km bounding box)
  let nearbyEvents: {
    id: string; title: string; genre: string | string[]; event_type: string;
    date_time: string; location_name: string | null; city: string | null;
    state: string | null; country: string | null; virtual_url: string | null;
    open_mic: boolean; banner_url: string | null; ticket_url: string | null;
    description: string | null; is_imported: boolean; source_url: string | null;
    source_name: string | null;
    organizer: { id: string; name: string } | null;
  }[] = [];

  if (event.lat && event.lng) {
    const delta = 0.45;
    const { data: nearby } = await supabase
      .from("events")
      .select("id, title, genre, event_type, date_time, location_name, city, state, country, virtual_url, open_mic, banner_url, ticket_url, description, is_imported, source_url, source_name, lat, lng, organizer:organizer_profiles(id, name)")
      .eq("event_type", "in_person")
      .gte("date_time", new Date().toISOString())
      .neq("id", id)
      .gte("lat", event.lat - delta)
      .lte("lat", event.lat + delta)
      .gte("lng", event.lng - delta)
      .lte("lng", event.lng + delta)
      .order("date_time", { ascending: true })
      .limit(4);

    nearbyEvents = (nearby ?? []).map((e) => ({
      ...e,
      organizer: Array.isArray(e.organizer) ? e.organizer[0] : e.organizer,
    }));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isSaved = false;
  let isRsvp = false;

  if (user) {
    const [savedResult, rsvpResult] = await Promise.all([
      supabase
        .from("saved_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle(),
      supabase
        .from("rsvps")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle(),
    ]);
    isSaved = !!savedResult.data;
    isRsvp = !!rsvpResult.data;
  }

  const organizer = Array.isArray(event.organizer)
    ? event.organizer[0]
    : event.organizer;

  const featuredReaders = event.featured_readers as
    | { name: string; url: string }[]
    | null;

  const isPast = new Date(event.date_time) < new Date();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/events"
          className="text-cream-muted text-sm hover:text-cream transition"
        >
          ← Events
        </Link>
      </div>

      {/* Banner */}
      {event.banner_url && (
        <div className="w-full rounded-2xl overflow-hidden mb-6">
          <Image
            src={event.banner_url}
            alt={event.title}
            width={0}
            height={0}
            sizes="(max-width: 768px) 100vw, 768px"
            className="w-full h-auto"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            {(Array.isArray(event.genre) ? event.genre : [event.genre]).map((g: Genre) => (
              <span key={g} className="px-3 py-1 rounded-full bg-orange/15 text-orange text-sm font-medium">
                {GENRE_LABELS[g]}
              </span>
            ))}
            {event.event_type === "virtual" && (
              <span className="px-3 py-1 rounded-full bg-cream/10 text-cream-muted text-sm">
                Virtual
              </span>
            )}
            {isPast && (
              <span className="px-3 py-1 rounded-full bg-cream/10 text-cream-muted text-sm">
                Past event
              </span>
            )}
          </div>
          <SaveButton eventId={event.id} initialSaved={isSaved} />
        </div>

        <h1 className="font-serif text-3xl md:text-4xl text-cream mb-6 leading-tight">
          {event.title}
        </h1>

        {/* Date & time */}
        <div className="space-y-3 mb-6">
          <AddToCalendarButton
            eventId={event.id}
            dateTime={event.date_time}
            endTime={event.end_time}
            title={event.title}
            description={event.description}
            location={[event.location_name, event.address, event.city, event.state, event.country].filter(Boolean).join(", ")}
          />

          {event.event_type === "in_person" && event.location_name && (() => {
            const addressParts = [
              event.location_name,
              event.address,
              event.city,
              event.state,
              event.country,
            ].filter(Boolean).join(", ");
            const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressParts)}`;
            return (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-cream hover:text-orange transition group"
              >
                <PinIcon />
                <div>
                  <div className="group-hover:underline">{event.location_name}</div>
                  {event.address && (
                    <div className="text-cream-muted text-sm">{event.address}</div>
                  )}
                  {(event.city || event.state || event.country) && (
                    <div className="text-cream-muted text-sm">
                      {[event.city, event.state, event.country].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
              </a>
            );
          })()}

          {event.event_type === "virtual" && event.virtual_url && (
            <div className="flex items-center gap-3 text-cream">
              <GlobeIcon />
              <a
                href={event.virtual_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange hover:underline"
              >
                Join online event ↗
              </a>
            </div>
          )}
        </div>

        {/* Tickets + RSVP */}
        {!isPast && (event.ticket_url || event.rsvp_enabled) && (
          <div className="flex flex-wrap gap-3">
            {event.ticket_url && (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition"
              >
                {event.ticket_type === "free" ? "Register (free) ↗" : "Get tickets ↗"}
              </a>
            )}
            {event.rsvp_enabled && (
              <RsvpButton eventId={event.id} initialRsvp={isRsvp} user={user} />
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 mb-6">
          <h2 className="font-serif text-xl text-cream mb-4">About this event</h2>
          <p className="text-cream-muted leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        </div>
      )}

      {/* Featured readers */}
      {featuredReaders && featuredReaders.length > 0 && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 mb-6">
          <h2 className="font-serif text-xl text-cream mb-4">Featured readers</h2>
          <div className="flex flex-wrap gap-3">
            {featuredReaders.map((reader, i) => (
              <a
                key={i}
                href={reader.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full border border-cream/20 text-cream text-sm hover:border-orange hover:text-orange transition"
              >
                {reader.name} ↗
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Organizer */}
      {organizer && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 mb-6">
          <h2 className="font-serif text-xl text-cream mb-4">Organized by</h2>
          <Link
            href={`/organizers/${organizer.id}`}
            className="flex items-center gap-4 group"
          >
            <div className="relative w-12 h-12 shrink-0">
              {(organizer as typeof organizer & { avatar_url?: string | null }).avatar_url ? (
                <Image
                  src={(organizer as typeof organizer & { avatar_url?: string | null }).avatar_url!}
                  alt={organizer.name}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-orange/20 flex items-center justify-center text-orange font-serif text-xl">
                  {organizer.name[0]}
                </div>
              )}
            </div>
            <div>
              <div className="text-cream font-medium group-hover:text-orange transition">
                {organizer.name}
              </div>
              <div className="text-cream-muted text-sm capitalize">
                {organizer.org_type}
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Nearby events */}
      {nearbyEvents.length > 0 && (
        <div>
          <h2 className="font-serif text-xl text-cream mb-4">More events nearby</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nearbyEvents.map((e) => (
              <EventCard key={e.id} event={e as Parameters<typeof EventCard>[0]["event"]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg className="w-5 h-5 text-orange shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z" />
      <circle cx="12" cy="8.5" r="2.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-5 h-5 text-orange shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
