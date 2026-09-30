import AdminEventsClient, { type AdminEvent } from "./AdminEventsClient";
import { requireSiteAdmin } from "@/lib/requireSiteAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = await requireSiteAdmin("/admin/events");
  const { data } = await supabase
    .from("events")
    .select(`id, title, genre, event_type, date_time, is_imported, source_name, banner_url,
             organizer:organizer_profiles!events_organizer_id_fkey(id, name)`)
    .order("date_time", { ascending: false });
  return <AdminEventsClient initialEvents={(data ?? []) as AdminEvent[]} />;
}
