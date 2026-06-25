import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import EventCard from "@/components/EventCard";
import FollowButton from "@/components/FollowButton";

export default async function OrganizerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: organizerRaw } = await supabase
    .from("organizer_profiles")
    .select("id, user_id, name, org_type, bio, website, social_links, avatar_url")
    .eq("id", id)
    .single();

  if (!organizerRaw) notFound();

  const organizer = organizerRaw;

  const now = new Date().toISOString();
  const eventSelect = "id, title, description, genre, event_type, date_time, timezone, end_time, location_name, city, state, country, virtual_url, open_mic, rsvp_enabled, created_at, recurrence_rule, organizer:organizer_profiles!events_organizer_id_fkey(id, name, org_type)";

  // Fetch all top-level events (parents + one-offs) so recurring series with a
  // past parent date but future children are not silently dropped.
  const [allParentsResult, pastResult] = await Promise.all([
    supabase
      .from("events")
      .select(eventSelect)
      .eq("organizer_id", id)
      .eq("is_cancelled", false)
      .is("parent_event_id", null)
      .order("date_time", { ascending: true }),
    supabase
      .from("events")
      .select(eventSelect)
      .eq("organizer_id", id)
      .eq("is_cancelled", false)
      .is("parent_event_id", null)
      .lt("date_time", now)
      .order("date_time", { ascending: false })
      .limit(12),
  ]);

  const allParents = allParentsResult.data ?? [];

  // For recurring series, find the next future occurrence date
  const upcomingEvents = [];
  const isFuture = (iso: string) => iso >= now;

  for (const event of allParents) {
    if (event.recurrence_rule) {
      // Check if the parent itself is upcoming, or if any child is
      if (isFuture(event.date_time)) {
        upcomingEvents.push(event);
      } else {
        const { data: nextChild } = await supabase
          .from("events")
          .select("date_time")
          .eq("parent_event_id", event.id)
          .eq("is_cancelled", false)
          .gte("date_time", now)
          .order("date_time", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (nextChild) {
          upcomingEvents.push({ ...event, date_time: nextChild.date_time });
        }
      }
    } else if (isFuture(event.date_time)) {
      upcomingEvents.push(event);
    }
  }

  upcomingEvents.sort((a, b) => a.date_time.localeCompare(b.date_time));

  const pastEvents = pastResult.data ?? [];

  // Check if current user follows this organizer
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isFollowing = false;

  if (user) {
    const { data: followResult } = await supabase
      .from("follows")
      .select("id")
      .eq("patron_id", user.id)
      .eq("organizer_id", id)
      .maybeSingle();
    isFollowing = !!followResult;
  }

  const socialLinks = organizer.social_links as Record<string, string> | null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Profile header */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 mb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 shrink-0">
              {organizer.avatar_url ? (
                <Image
                  src={organizer.avatar_url}
                  alt={organizer.name}
                  fill
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-orange/20 flex items-center justify-center text-orange font-sans text-3xl">
                  {organizer.name[0]}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-serif text-3xl text-cream leading-tight">
                {organizer.name}
              </h1>
              <p className="text-cream-muted text-sm capitalize mt-0.5">
                {organizer.org_type === "organization"
                  ? "Organization / Series"
                  : "Individual organizer"}
              </p>
            </div>
          </div>

          {/* Follow button — hidden only on your own org profile. Logged-out
              visitors see it too; clicking it sends them to /login */}
          {(!user || user.id !== organizer.user_id) && (
            <FollowButton
              organizerId={id}
              initialFollowing={isFollowing}
            />
          )}
        </div>

        {organizer.bio && (
          <p className="text-cream-muted leading-relaxed mt-6 max-w-2xl">
            {organizer.bio}
          </p>
        )}

        {/* Links */}
        {(organizer.website || socialLinks) && (
          <div className="flex flex-wrap gap-3 mt-5">
            {organizer.website && /^https?:\/\//i.test(organizer.website) && (
              <a
                href={organizer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-full border border-cream/20 text-cream-muted text-sm hover:text-cream hover:border-cream/40 transition"
              >
                Website ↗
              </a>
            )}
            {socialLinks &&
              Object.entries(socialLinks).map(([platform, url]) =>
                url && /^https?:\/\//i.test(url) ? (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded-full border border-cream/20 text-cream-muted text-sm hover:text-cream hover:border-cream/40 transition capitalize"
                  >
                    {platform} ↗
                  </a>
                ) : null
              )}
          </div>
        )}
      </div>

      {/* Upcoming events */}
      <section className="mb-10">
        <h2 className="font-serif text-2xl text-cream mb-4">
          Upcoming events
          {upcomingEvents.length > 0 && (
            <span className="ml-3 font-sans text-base text-cream-muted font-normal">
              {upcomingEvents.length}
            </span>
          )}
        </h2>

        {upcomingEvents.length === 0 ? (
          <div className="bg-navy-light border border-cream/10 rounded-2xl p-10 text-center">
            <p className="text-cream-muted">No upcoming events posted yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-cream mb-4">
            Past events
            <span className="ml-3 font-sans text-base text-cream-muted font-normal">
              {pastEvents.length}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
            {pastEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
