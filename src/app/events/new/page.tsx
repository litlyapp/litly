import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/activeOrg";
import EventForm from "@/components/EventForm";
import ImportFromUrl from "@/components/ImportFromUrl";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/events/new");

  // Use the active org from cookie
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  if (orgIds.length === 0) redirect("/become-organizer");

  const activeOrgId = await getActiveOrgId(orgIds);
  if (!activeOrgId) redirect("/become-organizer");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgProfile } = await (supabase as any)
    .from("organizer_profiles")
    .select("id, name, default_banner_url, default_banner_for_all_events")
    .eq("id", activeOrgId)
    .maybeSingle() as { data: { id: string; name: string; default_banner_url: string | null; default_banner_for_all_events: boolean } | null };

  if (!orgProfile) redirect("/become-organizer");

  // Pre-fill from an existing event if ?from=<id> is set
  const { from } = await searchParams;
  let initialData: Record<string, unknown> | undefined = undefined;

  if (from) {
    const { data: source } = await supabase
      .from("events")
      .select("title, description, genre, event_type, location_name, address, city, state, country, lat, lng, virtual_url, open_mic, featured_readers, rsvp_enabled, banner_url, ticket_url")
      .eq("id", from)
      .eq("organizer_id", orgProfile.id)
      .single();

    if (source) {
      initialData = {
        ...source,
        date_time: "",   // must pick a new date
        end_time: null,
      };
    }
  } else if (orgProfile.default_banner_for_all_events && orgProfile.default_banner_url) {
    // Pre-fill the default banner for blank new events when the org has opted in
    initialData = { banner_url: orgProfile.default_banner_url };
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">
          {from ? "Duplicate event" : "New event"}
        </h1>
        <p className="text-cream-muted">
          {from
            ? `Duplicating — pick a new date and publish.`
            : `Posting as ${orgProfile.name}`}
        </p>
      </div>
      {!from && (
        <>
          <ImportFromUrl organizerId={orgProfile.id} />
          <div className="flex items-center gap-3 mb-8">
            <div className="flex-1 h-px bg-cream/10" />
            <span className="text-cream-muted text-xs uppercase tracking-wider">or enter manually</span>
            <div className="flex-1 h-px bg-cream/10" />
          </div>
        </>
      )}
      <EventForm
        organizerId={orgProfile.id}
        initialData={initialData as Parameters<typeof EventForm>[0]["initialData"]}
        allowSourceAttribution={user.email === "admin@thelitlyapp.com"}
      />
    </div>
  );
}
