import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardEventRow from "@/components/DashboardEventRow";
import type { Genre, EventType } from "@/types/database";

export const dynamic = "force-dynamic";

interface DashboardEvent {
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
  is_cancelled?: boolean;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/");

  const now = new Date().toISOString();

  const [upcomingResult, pastResult] = await Promise.all([
    supabase
      .from("events")
      .select("*")
      .eq("organizer_id", profile.id)
      .gte("date_time", now)
      .order("date_time", { ascending: true }),
    supabase
      .from("events")
      .select("*")
      .eq("organizer_id", profile.id)
      .lt("date_time", now)
      .order("date_time", { ascending: false })
      .limit(20),
  ]);

  const allUpcoming = (upcomingResult.data ?? []) as DashboardEvent[];
  const pastEvents = (pastResult.data ?? []) as DashboardEvent[];

  // Separate series children from the display list — group under their parent
  const upcomingChildren = allUpcoming.filter((e) => !!e.parent_event_id);
  const upcomingEvents = allUpcoming.filter((e) => !e.parent_event_id);

  // Count upcoming non-cancelled children per series parent
  const upcomingChildCounts: Record<string, number> = {};
  for (const child of upcomingChildren) {
    const pid = child.parent_event_id!;
    if (!child.is_cancelled) {
      upcomingChildCounts[pid] = (upcomingChildCounts[pid] ?? 0) + 1;
    }
  }

  const allEventIds = [...allUpcoming, ...pastEvents].map((e) => e.id);
  const rsvpCounts: Record<string, number> = {};
  const saveCounts: Record<string, number> = {};
  const viewCounts: Record<string, number> = {};
  const clickCounts: Record<string, number> = {};

  if (allEventIds.length > 0) {
    const [rsvpRows, saveRows] = await Promise.all([
      supabase.from("rsvps").select("event_id").in("event_id", allEventIds),
      supabase.from("saved_events").select("event_id").in("event_id", allEventIds),
    ]);

    // Aggregate RSVP and save counts — roll child counts up to the parent
    (rsvpRows.data ?? []).forEach((r) => {
      const event = allUpcoming.find((e) => e.id === r.event_id) ?? pastEvents.find((e) => e.id === r.event_id);
      const key = event?.parent_event_id ?? r.event_id;
      rsvpCounts[key] = (rsvpCounts[key] ?? 0) + 1;
    });
    (saveRows.data ?? []).forEach((r) => {
      const event = allUpcoming.find((e) => e.id === r.event_id) ?? pastEvents.find((e) => e.id === r.event_id);
      const key = event?.parent_event_id ?? r.event_id;
      saveCounts[key] = (saveCounts[key] ?? 0) + 1;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statRaw = await (supabase as any)
      .from("events")
      .select("id, view_count, ticket_click_count, parent_event_id")
      .in("id", allEventIds);
    (statRaw.data ?? []).forEach((r: { id: string; view_count?: number; ticket_click_count?: number; parent_event_id?: string | null }) => {
      const key = r.parent_event_id ?? r.id;
      viewCounts[key] = (viewCounts[key] ?? 0) + (r.view_count ?? 0);
      clickCounts[key] = (clickCounts[key] ?? 0) + (r.ticket_click_count ?? 0);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-cream mb-1">Dashboard</h1>
          <p className="text-cream-muted">{profile.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/profile"
            className="border border-cream/20 text-cream-muted font-medium px-4 py-2.5 rounded-full hover:border-cream/40 hover:text-cream transition text-sm"
          >
            Edit profile
          </Link>
          <Link
            href="/events/new"
            className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
          >
            + New event
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Upcoming" value={allUpcoming.length} />
        <StatCard label="Past events" value={pastEvents.length} />
        <StatCard label="Total posted" value={upcomingEvents.length + pastEvents.length} />
      </div>

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
          <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden">
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
              />
            ))}
          </div>
        )}
      </section>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-cream mb-4">Past events</h2>
          <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden opacity-70">
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
          </div>
        </section>
      )}

      <div className="mt-10 pt-6 border-t border-cream/10 text-center">
        <p className="text-cream-muted text-sm mb-2">Having trouble posting or editing an event?</p>
        <Link
          href="/dashboard/support"
          className="text-orange hover:text-orange/80 text-sm underline underline-offset-2 transition"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-navy-light border border-cream/10 rounded-2xl p-5">
      <div className="font-serif text-3xl text-cream mb-1">{value}</div>
      <div className="text-cream-muted text-sm">{label}</div>
    </div>
  );
}
