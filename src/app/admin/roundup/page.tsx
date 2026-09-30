import AdminRoundupClient, { type RoundupEvent } from "./AdminRoundupClient";
import { requireSiteAdmin } from "@/lib/requireSiteAdmin";

export const dynamic = "force-dynamic";

export default async function AdminRoundupPage() {
  const supabase = await requireSiteAdmin("/admin/roundup");
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86400_000);
  const { data } = await supabase
    .from("events")
    .select(`id, title, genre, event_type, date_time, timezone, location_name,
             city, state, is_imported, source_name,
             organizer:organizer_profiles!events_organizer_id_fkey(name)`)
    .eq("is_cancelled", false)
    .gte("date_time", now.toISOString())
    .lte("date_time", in30Days.toISOString())
    .order("date_time", { ascending: true });
  return <AdminRoundupClient initialEvents={(data ?? []) as RoundupEvent[]} />;
}
