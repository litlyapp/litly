import { createClient } from "@/lib/supabase/server";
import EventMap from "@/components/EventMap";

export const dynamic = "force-dynamic";

export default async function EventMapPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      "id, title, genre, event_type, date_time, lat, lng, location_name, organizer:organizer_profiles(id, name)"
    )
    .eq("event_type", "in_person")
    .eq("is_cancelled", false)
    .gte("date_time", new Date().toISOString())
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("date_time", { ascending: true });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-serif text-4xl text-cream mb-1">Event map</h1>
        <p className="text-cream-muted">In-person events near you.</p>
      </div>
      <EventMap events={events ?? []} />
    </div>
  );
}
