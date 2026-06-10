import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Clean up orgs this user belongs to that would become orphaned (no other
  // members and no events) once this account is deleted — otherwise a stale
  // organizer_profiles row with user_id=null is left behind forever and
  // shows up in organizer search.
  const { data: memberships } = await serviceClient
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  for (const { org_id } of memberships ?? []) {
    const { count: otherMembers } = await serviceClient
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org_id)
      .neq("user_id", user.id);

    if ((otherMembers ?? 0) > 0) continue;

    const { count: eventCount } = await serviceClient
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", org_id);

    if ((eventCount ?? 0) > 0) continue;

    await serviceClient.from("organizer_profiles").delete().eq("id", org_id);
  }

  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
