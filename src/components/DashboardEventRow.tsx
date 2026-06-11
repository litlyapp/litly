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
    timezone?: string | null;
    location_name: string | null;
    virtual_url: string | null;
    rsvp_enabled: boolean;
    open_mic: boolean;
    parent_event_id?: string | null;
    recurrence_rule?: object | null;
    is_cancelled?: boolean;
  };
  divider?: boolean;
  isPast?: boolean;
  rsvpCount?: number;
  viewCount?: number;
  saveCount?: number;
  clickCount?: number;
  upcomingInSeries?: number;
}

function formatDate(iso: string, timeZone?: string | null) {
  return `${formatEventDate(iso, timeZone)} · ${formatEventTime(iso, timeZone)}`;
}

export default function DashboardEventRow({ event, divider, isPast, rsvpCount, viewCount, saveCount, clickCount, upcomingInSeries }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const isRecurring = !!(event.parent_event_id || event.recurrence_rule);
  const parentId = event.parent_event_id ?? event.id;

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    if (isRecurring) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: childError } = await (supabase as any).from("events").delete().eq("parent_event_id", parentId);
      if (childError) { setDeleteError(childError.message); setDeleting(false); return; }
      const { error: parentError } = await supabase.from("events").delete().eq("id", parentId);
      if (parentError) { setDeleteError(parentError.message); setDeleting(false); return; }
    } else {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) { setDeleteError(error.message); setDeleting(false); return; }
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 ${divider ? "border-b border-cream/10" : ""}`}>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {(Array.isArray(event.genre) ? event.genre : [event.genre]).map((g) => (
            <span key={g} className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
              {GENRE_LABELS[g]}
            </span>
          ))}
          {event.event_type === "virtual" && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">Virtual</span>
          )}
          {event.open_mic && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">Open mic</span>
          )}
          {isRecurring && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
              🔁 Series{upcomingInSeries !== undefined ? ` · ${upcomingInSeries} upcoming` : ""}
            </span>
          )}
          {event.is_cancelled && (
            <span className="px-2 py-0.5 rounded-full bg-orange/20 text-orange text-xs font-medium">
              Cancelled
            </span>
          )}
          {event.rsvp_enabled && rsvpCount !== undefined && rsvpCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
              {rsvpCount} RSVP{rsvpCount !== 1 ? "s" : ""}
            </span>
          )}
          {event.rsvp_enabled && (rsvpCount === undefined || rsvpCount === 0) && (
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">RSVPs on</span>
          )}
        </div>

        <Link
          href={`/events/${event.id}`}
          className="text-cream font-medium hover:text-orange transition line-clamp-2 sm:line-clamp-1"
        >
          {event.title}
        </Link>

        <p className="text-cream-muted text-xs mt-0.5">
          {formatDate(event.date_time, event.timezone)}
          {event.event_type === "in_person" && event.location_name && <> · {event.location_name}</>}
        </p>

        {/* Analytics */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-cream-muted/70">
          <span title="Views">👁 {viewCount ?? 0}</span>
          <span title="Saves">🔖 {saveCount ?? 0}</span>
          {event.rsvp_enabled && <span title="RSVPs">✓ {rsvpCount ?? 0}</span>}
          {(clickCount ?? 0) > 0 && <span title="Ticket clicks">🎫 {clickCount}</span>}
        </div>
      </div>

      {/* Actions — below the info on mobile, beside it on wider screens */}
      <div className="flex items-start gap-2 shrink-0">
        {confirming ? (
          <div className="flex flex-col items-end gap-2">
            <span className="text-cream-muted text-xs">
              {isRecurring
                ? `Delete entire series${upcomingInSeries !== undefined ? ` (${upcomingInSeries + 1} occurrences)` : ""}?`
                : "Delete this event?"}
            </span>
            {deleteError && <p className="text-orange text-xs text-right">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-orange text-xs border border-orange/40 rounded-full px-3 py-1 hover:bg-orange/10 transition disabled:opacity-60"
              >
                {deleting ? "…" : "Confirm delete"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1 hover:text-cream transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <Link
              href={`/events/${event.id}/edit`}
              className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-cream hover:border-cream/40 transition"
            >
              Edit
            </Link>
            <Link
              href={`/events/new?from=${event.id}`}
              className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-cream hover:border-cream/40 transition"
            >
              Duplicate
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
