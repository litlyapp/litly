import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "@/components/EventForm";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/events/${id}/edit`);

  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/");

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("organizer_id", profile.id)
    .single();

  if (!event) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Edit event</h1>
        <p className="text-cream-muted line-clamp-1">{event.title}</p>
      </div>
      <EventForm organizerId={profile.id} initialData={event} eventId={id} />
    </div>
  );
}
