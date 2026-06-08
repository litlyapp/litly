import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import type { Genre, EventType } from "@/types/database";

interface JoinedEvent {
  id: string;
  title: string;
  description: string | null;
  genre: Genre;
  event_type: EventType;
  date_time: string;
  timezone?: string | null;
  end_time: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  virtual_url: string | null;
  open_mic: boolean;
  rsvp_enabled: boolean;
  created_at: string;
  organizer: { id: string; name: string; org_type: string } | null;
}

interface RsvpRow {
  event_id: string;
  event: JoinedEvent | JoinedEvent[] | null;
}

interface SavedRow {
  event_id: string;
  event: JoinedEvent | JoinedEvent[] | null;
}

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/saved");

  // Fetch RSVPs with full event data
  const { data: rsvpRows } = await supabase
    .from("rsvps")
    .select<string, RsvpRow>(
      `
      event_id,
      event:events(
        id, title, description, genre, event_type, date_time, timezone, end_time,
        location_name, city, state, country, address, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
        organizer:organizer_profiles(id, name, org_type)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch saved events with full event data
  const { data: savedRows } = await supabase
    .from("saved_events")
    .select<string, SavedRow>(
      `
      event_id,
      event:events(
        id, title, description, genre, event_type, date_time, timezone, end_time,
        location_name, city, state, country, address, lat, lng, virtual_url, open_mic, rsvp_enabled, created_at,
        organizer:organizer_profiles(id, name, org_type)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rsvpEventIds = new Set(
    (rsvpRows ?? []).map((r) => r.event_id).filter(Boolean) as string[]
  );

  const savedEventIds = new Set(
    (savedRows ?? []).map((r) => r.event_id).filter(Boolean) as string[]
  );

  // RSVPs pinned to top — extract event objects
  const rsvpEvents = (rsvpRows ?? [])
    .map((r) => (Array.isArray(r.event) ? r.event[0] : r.event))
    .filter(Boolean);

  // Saved-only: exclude events the user has also RSVP'd to
  const savedOnlyEvents = (savedRows ?? [])
    .map((r) => (Array.isArray(r.event) ? r.event[0] : r.event))
    .filter((e) => e && !rsvpEventIds.has(e.id));

  const totalCount = rsvpEvents.length + savedOnlyEvents.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Saved events</h1>
        <p className="text-cream-muted">
          {totalCount === 0
            ? "Nothing saved yet."
            : `${totalCount} ${totalCount === 1 ? "event" : "events"}`}
        </p>
      </div>

      {totalCount === 0 && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-16 text-center">
          <p className="font-serif text-2xl text-cream mb-3">Your list is empty</p>
          <p className="text-cream-muted text-sm max-w-xs mx-auto">
            Heart any event on the browse page to save it here.
          </p>
        </div>
      )}

      {/* RSVPs — pinned section */}
      {rsvpEvents.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-serif text-xl text-cream">You&apos;re going</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-orange/15 text-orange text-xs font-medium">
              {rsvpEvents.length} RSVP{rsvpEvents.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rsvpEvents.map(
              (event) =>
                event && (
                  <EventCard
                    key={event.id}
                    event={event}
                    savedEventIds={savedEventIds}
                    rsvpEventIds={rsvpEventIds}
                  />
                )
            )}
          </div>
        </section>
      )}

      {/* Saved-only section */}
      {savedOnlyEvents.length > 0 && (
        <section>
          {rsvpEvents.length > 0 && (
            <h2 className="font-serif text-xl text-cream mb-4">Also saved</h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedOnlyEvents.map(
              (event) =>
                event && (
                  <EventCard
                    key={event.id}
                    event={event}
                    savedEventIds={savedEventIds}
                    rsvpEventIds={rsvpEventIds}
                  />
                )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
