"use client";

import Link from "next/link";
import DashboardEventRow from "@/components/DashboardEventRow";
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
  is_published?: boolean;
}

interface Props {
  draftEvents: DashboardEventClientData[];
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
  draftEvents,
  upcomingEvents,
  pastEvents,
  rsvpCounts,
  saveCounts,
  viewCounts,
  clickCounts,
  upcomingChildCounts,
  needsDetailsIds,
}: Props) {
  return (
    <>
      {/* Drafts */}
      {draftEvents.length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="font-serif text-2xl text-cream">Drafts</h2>
            <p className="text-cream-muted text-xs mt-0.5">
              Not visible to the public — edit and post when ready.
            </p>
          </div>
          <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden">
            {draftEvents.map((event, i) => (
              <DashboardEventRow
                key={event.id}
                event={event}
                divider={i < draftEvents.length - 1}
                isDraft
                rsvpCount={0}
                saveCount={0}
                viewCount={0}
                clickCount={0}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl text-cream mb-4">Upcoming events</h2>

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
    </>
  );
}
