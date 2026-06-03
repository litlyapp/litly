import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { Genre } from "@/types/database";
import { GENRE_LABELS } from "@/lib/genres";
import SaveButton from "@/components/SaveButton";
import RsvpButton from "@/components/RsvpButton";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
      organizer:organizer_profiles(id, name, org_type, bio, website, social_links)
    `
    )
    .eq("id", id)
    .single();

  if (!event) notFound();

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
        <div className="relative w-full h-64 rounded-2xl overflow-hidden mb-6">
          <Image
            src={event.banner_url}
            alt={event.title}
            fill
            className="object-cover"
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
          <div className="flex items-center gap-3 text-cream">
            <CalendarIcon />
            <div>
              <div>{formatDateTime(event.date_time)}</div>
              {event.end_time && (
                <div className="text-cream-muted text-sm">
                  Until {formatDateTime(event.end_time)}
                </div>
              )}
            </div>
          </div>

          {event.event_type === "in_person" && event.location_name && (
            <div className="flex items-center gap-3 text-cream">
              <PinIcon />
              <div>
                <div>{event.location_name}</div>
                {event.address && (
                  <div className="text-cream-muted text-sm">{event.address}</div>
                )}
              </div>
            </div>
          )}

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
                Get tickets ↗
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
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8">
          <h2 className="font-serif text-xl text-cream mb-4">Organized by</h2>
          <Link
            href={`/organizers/${organizer.id}`}
            className="flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-full bg-orange/20 flex items-center justify-center text-orange font-serif text-xl shrink-0">
              {organizer.name[0]}
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
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5 text-orange shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
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
