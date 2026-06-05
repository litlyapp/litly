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
      .select<string, DashboardEvent>(
        "id, title, genre, event_type, date_time, location_name, virtual_url, rsvp_enabled, open_mic"
      )
      .eq("organizer_id", profile.id)
      .gte("date_time", now)
      .order("date_time", { ascending: true }),
    supabase
      .from("events")
      .select<string, DashboardEvent>(
        "id, title, genre, event_type, date_time, location_name, virtual_url, rsvp_enabled, open_mic"
      )
      .eq("organizer_id", profile.id)
      .lt("date_time", now)
      .order("date_time", { ascending: false })
      .limit(20),
  ]);

  const upcomingEvents = upcomingResult.data ?? [];
  const pastEvents = pastResult.data ?? [];

  // Fetch RSVP counts for all organizer events
  const allEventIds = [...upcomingEvents, ...pastEvents].map((e) => e.id);
  const rsvpCounts: Record<string, number> = {};

  if (allEventIds.length > 0) {
    const { data: rsvpRows } = await supabase
      .from("rsvps")
      .select("event_id")
      .in("event_id", allEventIds);

    (rsvpRows ?? []).forEach((r) => {
      rsvpCounts[r.event_id] = (rsvpCounts[r.event_id] ?? 0) + 1;
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
        <StatCard label="Upcoming" value={upcomingEvents.length} />
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
              />
            ))}
          </div>
        </section>
      )}
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
