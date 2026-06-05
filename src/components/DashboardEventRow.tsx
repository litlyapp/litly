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
    parent_event_id?: string | null;
    recurrence_rule?: object | null;
  };
  divider?: boolean;
  isPast?: boolean;
  rsvpCount?: number;
}

type DeleteScope = "this" | "future" | "all";

function formatDate(iso: string) {
  return `${formatEventDate(iso)} · ${formatEventTime(iso)}`;
}

export default function DashboardEventRow({ event, divider, isPast, rsvpCount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleteScope, setDeleteScope] = useState<DeleteScope>("this");
  const [deleting, setDeleting] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const isRecurring = !!(event.parent_event_id || event.recurrence_rule);
  const parentId = event.parent_event_id ?? event.id;

  async function handleDelete() {
    setDeleting(true);

    if (!isRecurring || deleteScope === "this") {
      await supabase.from("events").delete().eq("id", event.id);
    } else if (deleteScope === "future") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("events")
        .delete()
        .eq("parent_event_id", parentId)
        .gte("date_time", event.date_time);
      if (!event.parent_event_id) {
        await supabase.from("events").delete().eq("id", event.id);
      }
    } else if (deleteScope === "all") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("events").delete().eq("parent_event_id", parentId);
      await supabase.from("events").delete().eq("id", parentId);
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className={`px-5 py-4 flex items-start gap-4 ${divider ? "border-b border-cream/10" : ""}`}>
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
            <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">🔁 Series</span>
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
          className="text-cream font-medium hover:text-orange transition line-clamp-1"
        >
          {event.title}
        </Link>

        <p className="text-cream-muted text-xs mt-0.5">
          {formatDate(event.date_time)}
          {event.event_type === "in_person" && event.location_name && <> · {event.location_name}</>}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-start gap-2 shrink-0">
        {confirming ? (
          <div className="flex flex-col items-end gap-2">
            {/* Series delete scope picker */}
            {isRecurring && (
              <div className="flex flex-col gap-1 text-right">
                {(
                  [
                    { scope: "this" as DeleteScope, label: "This occurrence only" },
                    { scope: "future" as DeleteScope, label: "This and future occurrences" },
                    { scope: "all" as DeleteScope, label: "Entire series" },
                  ] as const
                ).map(({ scope, label }) => (
                  <label key={scope} className="flex items-center justify-end gap-2 cursor-pointer">
                    <span className="text-cream-muted text-xs">{label}</span>
                    <input
                      type="radio"
                      name={`deleteScope-${event.id}`}
                      value={scope}
                      checked={deleteScope === scope}
                      onChange={() => setDeleteScope(scope)}
                      className="accent-orange"
                    />
                  </label>
                ))}
              </div>
            )}
            {!isRecurring && (
              <span className="text-cream-muted text-xs">Delete this event?</span>
            )}
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
