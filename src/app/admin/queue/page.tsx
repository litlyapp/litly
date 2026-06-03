import { createClient } from "@supabase/supabase-js";
import AdminQueueClient from "./AdminQueueClient";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: items } = await supabase
    .from("pending_imports")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return <AdminQueueClient initialItems={items ?? []} />;
}
