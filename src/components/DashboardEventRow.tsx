"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Genre, EventType } from "@/types/database";
import { GENRE_LABELS } from "@/lib/genres";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";

interface Props {
  event: {
    id: string;
    title: string;
    genre: Genre | Genre[];
    event_type: EventType;
    date_time: string;
    location_name: string | null;
    virtual_url: string | null;
    rsvp_enabled: boolean;
    open_mic: boolean;
  };
  divider?: boolean;
  isPast?: boolean;
  rsvpCount?: number;
}

function formatDate(iso: string) {
  return `${formatEventDate(iso)} · ${formatEventTime(iso)}`;
}

export default function DashboardEventRow({ event, divider, isPast, rsvpCount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("events").delete().eq("id", event.id);
    startTransition(() => router.refresh());
  }

  return (
    <div
      className={`px-5 py-4 flex items-start gap-4 ${
        divider ? "border-b border-cream/10" : ""
      }`}
    >
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {(Array.isArray(event.genre) ? event.genre : [event.genre]).map((g) => (
            <span key={g} className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
              {GENRE_LABELS[g]}
            </span>
          ))}
          {event.event_type === "virtual" && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
              Virtual
            </span>
          )}
          {event.open_mic && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
              Open mic
            </span>
          )}
          {event.rsvp_enabled && rsvpCount !== undefined && rsvpCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
              {rsvpCount} RSVP{rsvpCount !== 1 ? "s" : ""}
            </span>
          )}
          {event.rsvp_enabled && (rsvpCount === undefined || rsvpCount === 0) && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
              RSVPs on
            </span>
          )}
        </div>

        <Link
          href={`/events/${event.id}`}
          className="text-cream font-medium hover:text-orange transition line-clamp-1"
        >
          {event.title}
        </Link>

        <p className="text-cream-muted text-xs mt-0.5">
          {formatDate(event.date_time)}
          {event.event_type === "in_person" && event.location_name && (
            <> · {event.location_name}</>
          )}
        </p>
      </div>

      {/* Actions — always available for both upcoming and past events */}
      <div className="flex items-center gap-2 shrink-0">
        {confirming ? (
          <>
            <span className="text-cream-muted text-xs">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-orange text-xs border border-orange/40 rounded-full px-3 py-1 hover:bg-orange/10 transition disabled:opacity-60"
            >
              {deleting ? "…" : "Yes, delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1 hover:text-cream transition"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <Link
              href={`/events/${event.id}/edit`}
              className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-cream hover:border-cream/40 transition"
            >
              Edit
            </Link>
            <button
              onClick={() => setConfirming(true)}
              className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-orange hover:border-orange/40 transition"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
