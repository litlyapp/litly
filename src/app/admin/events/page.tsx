import { createClient } from "@/lib/supabase/server";
import AdminEventsClient from "./AdminEventsClient";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select(
      `id, title, genre, event_type, date_time, is_imported, source_name, banner_url,
       organizer:organizer_profiles(id, name)`
    )
    .order("date_time", { ascending: false });

  return <AdminEventsClient initialEvents={events ?? []} />;
}
