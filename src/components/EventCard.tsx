import Link from "next/link";
import Image from "next/image";
import type { Genre, EventType } from "@/types/database";
import { GENRE_LABELS } from "@/lib/genres";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";
import SaveButton from "./SaveButton";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description: string | null;
    genre: Genre | Genre[];
    event_type: EventType;
    date_time: string;
    location_name: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    virtual_url: string | null;
    open_mic: boolean;
    is_imported?: boolean;
    source_url?: string | null;
    source_name?: string | null;
    banner_url?: string | null;
    ticket_url?: string | null;
    organizer: { id: string; name: string } | { id: string; name: string }[] | null;
  };
  savedEventIds?: Set<string>;
  rsvpEventIds?: Set<string>;
}



export default function EventCard({
  event,
  savedEventIds,
  rsvpEventIds,
}: EventCardProps) {
  const organizer = Array.isArray(event.organizer)
    ? event.organizer[0]
    : event.organizer;

  const isSaved = savedEventIds?.has(event.id) ?? false;
  const isRsvp = rsvpEventIds?.has(event.id) ?? false;

  return (
    <div className="relative bg-navy-light border border-cream/10 rounded-2xl overflow-hidden flex flex-col gap-3 hover:border-cream/25 transition group">
      {/* Banner image */}
      {event.banner_url && (
        <div className="w-full overflow-hidden">
          <Image
            src={event.banner_url}
            alt={event.title}
            width={0}
            height={0}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="w-full h-auto max-h-48 object-contain"
          />
        </div>
      )}

      <div className="relative p-5 flex flex-col gap-3 flex-1">
      {/* Save button */}
      <div className="absolute top-0 right-4">
        <SaveButton eventId={event.id} initialSaved={isSaved} />
      </div>

      {/* Genre + type pills */}
      <div className="flex gap-2 flex-wrap pr-8">
        {(Array.isArray(event.genre) ? event.genre : [event.genre]).map((g) => (
          <span key={g} className="px-2.5 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
            {GENRE_LABELS[g]}
          </span>
        ))}
        {event.event_type === "virtual" && (
          <span className="px-2.5 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
            Virtual
          </span>
        )}
        {event.ticket_url && (
          <span className="px-2.5 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
            Ticketed
          </span>
        )}
        {isRsvp && (
          <span className="px-2.5 py-0.5 rounded-full bg-orange/30 text-orange text-xs font-medium">
            RSVP'd
          </span>
        )}
      </div>

      {/* Title */}
      <Link href={`/events/${event.id}`} className="block">
        <h2 className="font-serif text-lg text-cream leading-snug group-hover:text-orange transition line-clamp-2">
          {event.title}
        </h2>
      </Link>

      {/* Date + location */}
      <div className="space-y-1 text-sm text-cream-muted">
        <div className="flex items-center gap-1.5">
          <CalendarIcon />
          <span>
            {formatEventDate(event.date_time)} · {formatEventTime(event.date_time)}
          </span>
        </div>
        {event.event_type === "in_person" && (event.city || event.location_name) && (
          <div className="flex items-center gap-1.5">
            <PinIcon />
            <span className="truncate">
              {event.city
                ? [event.city, event.state, event.country].filter(Boolean).join(", ")
                : event.location_name}
            </span>
          </div>
        )}
        {event.event_type === "virtual" && (
          <div className="flex items-center gap-1.5">
            <GlobeIcon />
            <span>Online event</span>
          </div>
        )}
      </div>

      {/* Organizer or imported source */}
      {(organizer || event.is_imported) && (
        <div className="mt-auto pt-2 border-t border-cream/10 flex items-center justify-between gap-2">
          {organizer && (
            <Link
              href={`/organizers/${organizer.id}`}
              className="text-cream-muted text-xs hover:text-cream transition truncate"
            >
              {organizer.name}
            </Link>
          )}
          {event.is_imported && event.source_name && (
            <span className="text-cream-muted/50 text-xs shrink-0">
              via {event.source_url ? (
                <a href={event.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-cream-muted transition">
                  {event.source_name}
                </a>
              ) : event.source_name}
            </span>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z" />
      <circle cx="12" cy="8.5" r="2.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
