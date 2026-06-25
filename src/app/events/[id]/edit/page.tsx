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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/events/${id}/edit`);

  // Fetch event, then verify user is a member of the owning org
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", event.organizer_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const ev = event as typeof event & {
    recurrence_rule: object | null;
    parent_event_id: string | null;
    is_published: boolean;
  };

  // Build series context if this event is part of a recurring series
  let seriesContext = undefined;
  const isRecurring = !!(ev.recurrence_rule || ev.parent_event_id);

  if (isRecurring) {
    const parentId = ev.parent_event_id ?? ev.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("parent_event_id", parentId)
      .gte("date_time", ev.date_time)
      .neq("id", id);

    seriesContext = {
      parentId,
      isParent: !ev.parent_event_id,
      futureCount: count ?? 0,
    };
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">
          {ev.is_published === false ? "Review imported event" : "Edit event"}
        </h1>
        <p className="text-cream-muted line-clamp-1">{event.title}</p>
        {ev.is_published === false && (
          <p className="text-orange text-sm mt-1">
            This event is a draft — review the details below and hit &quot;Publish event&quot; when ready.
          </p>
        )}
        {isRecurring && (
          <p className="text-orange text-sm mt-1">Part of a recurring series</p>
        )}
      </div>
      <EventForm
        organizerId={event.organizer_id}
        initialData={event}
        eventId={id}
        seriesContext={seriesContext}
        allowSourceAttribution={user.email === "admin@thelitlyapp.com"}
        highlightMissingFields={
          ev.event_type === "in_person"
            ? (ev.ticket_type as string | null) !== "none" && !ev.ticket_url
            : !ev.virtual_url
        }
      />
    </div>
  );
}
