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
  timezone?: string | null;
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

  // Load all orgs this user belongs to (as admin or editor)
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/become-organizer");

  const orgIds = memberships.map((m) => m.org_id);
  const isAdmin = memberships.some((m) => m.role === "admin");
  const adminOrgId = memberships.find((m) => m.role === "admin")?.org_id ?? null;

  // Fetch org names
  const { data: orgs } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .in("id", orgIds);

  const primaryOrgName = (orgs ?? [])[0]?.name ?? "Dashboard";

  const now = new Date().toISOString();

  const eventSelect = "id, title, genre, event_type, date_time, timezone, location_name, virtual_url, rsvp_enabled, open_mic, parent_event_id, recurrence_rule, is_cancelled, view_count, ticket_click_count";

  const [upcomingResult, pastResult, totalUpcomingResult] = await Promise.all([
    // Only show parent events and standalone events (exclude series children)
    supabase
      .from("events")
      .select(eventSelect)
      .in("organizer_id", orgIds)
      .is("parent_event_id", null)
      .gte("date_time", now)
      .order("date_time", { ascending: true }),
    supabase
      .from("events")
      .select(eventSelect)
      .in("organizer_id", orgIds)
      .is("parent_event_id", null)
      .lt("date_time", now)
      .order("date_time", { ascending: false })
      .limit(20),
    // Total upcoming count including all occurrences (for the stat card)
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .in("organizer_id", orgIds)
      .gte("date_time", now),
  ]);

  const upcomingEvents = (upcomingResult.data ?? []) as DashboardEvent[];
  const pastEvents = (pastResult.data ?? []) as DashboardEvent[];
  const totalUpcoming = totalUpcomingResult.count ?? 0;

  const upcomingChildCounts: Record<string, number> = {};
  for (const event of upcomingEvents) {
    if (!event.recurrence_rule) continue;
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("parent_event_id", event.id)
      .eq("is_cancelled", false)
      .gte("date_time", now);
    upcomingChildCounts[event.id] = count ?? 0;
  }

  const rsvpCounts: Record<string, number> = {};
  const saveCounts: Record<string, number> = {};
  const viewCounts: Record<string, number> = {};
  const clickCounts: Record<string, number> = {};

  const allDisplayed = [...upcomingEvents, ...pastEvents];

  for (const e of allDisplayed) {
    viewCounts[e.id] = (e as DashboardEvent & { view_count?: number }).view_count ?? 0;
    clickCounts[e.id] = (e as DashboardEvent & { ticket_click_count?: number }).ticket_click_count ?? 0;
  }

  const allEventIds = allDisplayed.map((e) => e.id);
  if (allEventIds.length > 0) {
    const [rsvpRows, saveRows] = await Promise.all([
      supabase.from("rsvps").select("event_id").in("event_id", allEventIds),
      supabase.from("saved_events").select("event_id").in("event_id", allEventIds),
    ]);
    (rsvpRows.data ?? []).forEach((r) => {
      rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] ?? 0) + 1;
    });
    (saveRows.data ?? []).forEach((r) => {
      saveCounts[r.event_id] = (saveCounts[r.event_id] ?? 0) + 1;
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl text-cream mb-1">Dashboard</h1>
            <p className="text-cream-muted">{primaryOrgName}</p>
          </div>
          <Link
            href="/events/new"
            className="shrink-0 bg-orange text-cream font-semibold px-4 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
          >
            + New event
          </Link>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {adminOrgId && (
              <Link
                href="/dashboard/team"
                className="border border-cream/20 text-cream-muted font-medium px-4 py-2 rounded-full hover:border-cream/40 hover:text-cream transition text-sm"
              >
                Team
              </Link>
            )}
            <Link
              href="/dashboard/profile"
              className="border border-cream/20 text-cream-muted font-medium px-4 py-2 rounded-full hover:border-cream/40 hover:text-cream transition text-sm"
            >
              Edit profile
            </Link>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatCard label="Upcoming" value={totalUpcoming} />
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
