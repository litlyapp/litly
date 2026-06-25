import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DashboardEventRow from "@/components/DashboardEventRow";
import ExpandableList from "@/components/ExpandableList";
import OrgSwitcher from "./OrgSwitcher";
import { getActiveOrgId } from "@/lib/activeOrg";
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
  ticket_url?: string | null;
  rsvp_enabled: boolean;
  open_mic: boolean;
  parent_event_id?: string | null;
  recurrence_rule?: object | null;
  is_cancelled?: boolean;
}

// Missing the relevant link (ticket for in-person, join link for virtual) —
// most commonly true for calendar-feed-synced events, since iCal has no
// dedicated ticket-link field. Banners are intentionally not checked here —
// plenty of legitimate events have none, so flagging every banner-less event
// would just be permanent noise orgs learn to ignore.
function isIncomplete(event: DashboardEvent): boolean {
  return event.event_type === "in_person" ? !event.ticket_url : !event.virtual_url;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const params = await searchParams;
  const justJoined = params.joined === "1";
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
  const activeOrgId = await getActiveOrgId(orgIds);
  const activeMembership = memberships.find((m) => m.org_id === activeOrgId);
  const isAdmin = activeMembership?.role === "admin";
  const adminOrgId = isAdmin ? activeOrgId : null;

  // Fetch all org names for the switcher
  const { data: orgs } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .in("id", orgIds);

  const orgList = (orgs ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    role: memberships.find((m) => m.org_id === o.id)?.role ?? "editor",
  }));

  const now = new Date().toISOString();
  const nowMs = Date.now();
  const isFuture = (iso: string) => new Date(iso).getTime() >= nowMs;

  const eventSelect = "id, title, genre, event_type, date_time, timezone, location_name, virtual_url, ticket_url, rsvp_enabled, open_mic, parent_event_id, recurrence_rule, is_cancelled, view_count, ticket_click_count";

  // Fetch every top-level event (series parents + one-offs) for this org. We
  // can't split upcoming/past on the parent's own date alone: a series parent's
  // date_time is frozen at the first occurrence, so a still-active series with
  // future child occurrences would otherwise be misfiled under "Past".
  const { data: allParentsData } = await supabase
    .from("events")
    .select(eventSelect)
    .eq("organizer_id", activeOrgId!)
    .is("parent_event_id", null)
    .order("date_time", { ascending: false });

  const allParents = (allParentsData ?? []) as DashboardEvent[];

  // For each recurring series, find how many upcoming occurrences remain and
  // the date of the next one (the soonest future occurrence among the parent
  // date and its child rows).
  const upcomingChildCounts: Record<string, number> = {};
  const seriesNextDate: Record<string, string> = {};
  for (const event of allParents) {
    if (!event.recurrence_rule) continue;
    const [{ count }, { data: nextChild }] = await Promise.all([
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("parent_event_id", event.id)
        .eq("is_cancelled", false)
        .gte("date_time", now),
      supabase
        .from("events")
        .select("date_time")
        .eq("parent_event_id", event.id)
        .eq("is_cancelled", false)
        .gte("date_time", now)
        .order("date_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    upcomingChildCounts[event.id] = count ?? 0;
    const candidates: string[] = [];
    if (isFuture(event.date_time)) candidates.push(event.date_time);
    if (nextChild?.date_time) candidates.push(nextChild.date_time);
    if (candidates.length) {
      candidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      seriesNextDate[event.id] = candidates[0];
    }
  }

  // Partition into upcoming vs past. A recurring series is upcoming as long as
  // it has any future occurrence, displayed at that next occurrence date.
  const upcomingEvents: DashboardEvent[] = [];
  const pastEvents: DashboardEvent[] = [];
  for (const event of allParents) {
    if (event.recurrence_rule) {
      const next = seriesNextDate[event.id];
      if (next) upcomingEvents.push({ ...event, date_time: next });
      else pastEvents.push(event);
    } else if (isFuture(event.date_time)) {
      upcomingEvents.push(event);
    } else {
      pastEvents.push(event);
    }
  }
  upcomingEvents.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  pastEvents.splice(55); // cap past list (query was ordered date desc)

  // Count each series once (not every materialized occurrence), so an infinite
  // series doesn't inflate the upcoming total with a year of pre-built dates.
  const totalUpcoming = upcomingEvents.length;
  const incompleteCount = upcomingEvents.filter(isIncomplete).length;

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
      {/* Joined banner */}
      {justJoined && (
        <div className="bg-orange/10 border border-orange/30 rounded-2xl px-5 py-4 mb-6 text-cream text-sm">
          Welcome to the team! You now have access to this organization's dashboard.
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl text-cream mb-1">Dashboard</h1>
            <OrgSwitcher orgs={orgList} activeOrgId={activeOrgId!} />
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
                Org team
              </Link>
            )}
            <Link
              href="/dashboard/profile"
              className="border border-cream/20 text-cream-muted font-medium px-4 py-2 rounded-full hover:border-cream/40 hover:text-cream transition text-sm"
            >
              Edit org profile
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

      {incompleteCount > 0 && (
        <div className="bg-orange/10 border border-orange/30 rounded-2xl px-5 py-4 mb-6 text-cream text-sm">
          {incompleteCount} upcoming event{incompleteCount !== 1 ? "s" : ""}{" "}
          {incompleteCount !== 1 ? "are" : "is"} missing a ticket/join link — look for the &quot;Needs details&quot; tag below.
        </div>
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
                needsDetails={isIncomplete(event)}
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
      <div className="font-sans text-3xl text-cream mb-1">{value}</div>
      <div className="text-cream-muted text-sm">{label}</div>
    </div>
  );
}
