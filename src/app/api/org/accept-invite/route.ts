import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invite } = await serviceClient
    .from("org_invites")
    .select("id, org_id, email, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  if (new Date(invite.expires_at) < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  }

  // Add to org
  await serviceClient
    .from("org_members")
    .upsert({ org_id: invite.org_id, user_id: user.id, role: "editor" }, { onConflict: "org_id,user_id", ignoreDuplicates: true });

  // Mark invite accepted
  await serviceClient
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Ensure user has organizer role
  const { data: userRow } = await serviceClient.from("users").select("role").eq("id", user.id).single();
  if (userRow?.role !== "organizer") {
    await serviceClient.from("users").update({ role: "organizer" }).eq("id", user.id);
    await serviceClient.auth.admin.updateUserById(user.id, { user_metadata: { role: "organizer" } });
  }

  return NextResponse.json({ ok: true });
}
