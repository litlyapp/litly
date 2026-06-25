"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardEventRow from "@/components/DashboardEventRow";
import DashboardBulkToolbar from "@/components/DashboardBulkToolbar";
import ExpandableList from "@/components/ExpandableList";
import type { Genre, EventType } from "@/types/database";

export interface DashboardEventClientData {
  id: string;
  title: string;
  genre: Genre | Genre[];
  event_type: EventType;
  date_time: string;
  timezone?: string | null;
  location_name: string | null;
  virtual_url: string | null;
  ticket_url?: string | null;
  rsvp_enabled: boolean;
  open_mic: boolean;
  parent_event_id?: string | null;
  recurrence_rule?: object | null;
  is_cancelled?: boolean;
}

interface Props {
  upcomingEvents: DashboardEventClientData[];
  pastEvents: DashboardEventClientData[];
  rsvpCounts: Record<string, number>;
  saveCounts: Record<string, number>;
  viewCounts: Record<string, number>;
  clickCounts: Record<string, number>;
  upcomingChildCounts: Record<string, number>;
  needsDetailsIds: Set<string>;
  incompleteCount: number;
  orgId: string;
}

export default function DashboardEventsClient({
  upcomingEvents,
  pastEvents,
  rsvpCounts,
  saveCounts,
  viewCounts,
  clickCounts,
  upcomingChildCounts,
  needsDetailsIds,
  incompleteCount,
  orgId,
}: Props) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allIds = upcomingEvents.map((e) => e.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function handleDone() {
    exitSelection();
    startTransition(() => router.refresh());
  }

  const allUpcomingSelected = upcomingEvents.length > 0 && selectedIds.size === upcomingEvents.length;

  return (
    <>
      {incompleteCount > 0 && (
        <div className="bg-orange/10 border border-orange/30 rounded-2xl px-5 py-4 mb-6 text-cream text-sm">
          {`${incompleteCount} upcoming event${incompleteCount !== 1 ? "s" : ""} ${incompleteCount !== 1 ? "are" : "is"} missing a ticket/join link — look for the "Needs details" tag below.`}
        </div>
      )}

      {/* Upcoming events */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-2xl text-cream">Upcoming events</h2>
          {upcomingEvents.length > 0 && (
            selectionMode ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="text-cream-muted text-xs hover:text-cream transition"
                >
                  {allUpcomingSelected ? "Deselect all" : "Select all"}
                </button>
                <button
                  onClick={exitSelection}
                  className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1 hover:text-cream hover:border-cream/40 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSelectionMode(true)}
                className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1 hover:text-cream hover:border-cream/40 transition"
              >
                Select
              </button>
            )
          )}
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="bg-navy-light border border-cream/10 rounded-2xl p-10 text-center">
            <p className="text-cream-muted mb-4">No upcoming events.</p>
            <Link
              href="/events/new"
              className="inline-block bg-orange text-cream text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition"
            >
              Post your first event
            </Link>
          </div>
        ) : (
          <ExpandableList
            initial={10}
            step={10}
            className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden"
          >
            {upcomingEvents.map((event, i) => (
              <DashboardEventRow
                key={event.id}
                event={event}
                divider={i < upcomingEvents.length - 1}
                rsvpCount={rsvpCounts[event.id] ?? 0}
                saveCount={saveCounts[event.id] ?? 0}
                viewCount={viewCounts[event.id] ?? 0}
                clickCount={clickCounts[event.id] ?? 0}
                upcomingInSeries={event.recurrence_rule ? (upcomingChildCounts[event.id] ?? 0) : undefined}
                needsDetails={needsDetailsIds.has(event.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(event.id)}
                onToggle={() => toggleSelect(event.id)}
              />
            ))}
          </ExpandableList>
        )}
      </section>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-cream mb-4">Past events</h2>
          <ExpandableList
            initial={5}
            step={10}
            className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden opacity-70"
          >
            {pastEvents.map((event, i) => (
              <DashboardEventRow
                key={event.id}
                event={event}
                divider={i < pastEvents.length - 1}
                isPast
                rsvpCount={rsvpCounts[event.id] ?? 0}
                saveCount={saveCounts[event.id] ?? 0}
                viewCount={viewCounts[event.id] ?? 0}
                clickCount={clickCounts[event.id] ?? 0}
              />
            ))}
          </ExpandableList>
        </section>
      )}

      {/* Bulk toolbar */}
      {selectionMode && selectedIds.size > 0 && (
        <DashboardBulkToolbar
          selectedIds={[...selectedIds]}
          orgId={orgId}
          onClear={() => setSelectedIds(new Set())}
          onDone={handleDone}
        />
      )}
    </>
  );
}
