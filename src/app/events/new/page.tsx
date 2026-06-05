import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/components/EventForm";

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

  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  // Pre-fill from an existing event if ?from=<id> is set
  const { from } = await searchParams;
  let initialData = undefined;

  if (from) {
    const { data: source } = await supabase
      .from("events")
      .select("title, description, genre, event_type, location_name, address, city, state, country, lat, lng, virtual_url, open_mic, featured_readers, rsvp_enabled, banner_url, ticket_url")
      .eq("id", from)
      .eq("organizer_id", profile.id)
      .single();

    if (source) {
      initialData = {
        ...source,
        date_time: "",   // must pick a new date
        end_time: null,
      };
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">
          {initialData ? "Duplicate event" : "New event"}
        </h1>
        <p className="text-cream-muted">
          {initialData
            ? `Duplicating "${initialData.title}" — pick a new date and publish.`
            : `Posting as ${profile.name}`}
        </p>
      </div>
      <EventForm organizerId={profile.id} initialData={initialData} />
    </div>
  );
}
