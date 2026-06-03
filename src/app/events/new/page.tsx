import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/components/EventForm";

export default async function NewEventPage() {
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">New event</h1>
        <p className="text-cream-muted">Posting as {profile.name}</p>
      </div>
      <EventForm organizerId={profile.id} />
    </div>
  );
}
