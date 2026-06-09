import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function requireAdmin(userId: string, orgId: string) {
  const svc = serviceClient();
  const { data } = await svc.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return data?.role === "admin";
}

// PUT /api/org/member — update a member's role
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, targetUserId, role } = await request.json();
  if (!orgId || !targetUserId || !role) return NextResponse.json({ error: "orgId, targetUserId, role required" }, { status: 400 });
  if (!["admin", "editor"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  if (!(await requireAdmin(user.id, orgId))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Prevent demoting the last admin (applies regardless of who is being demoted)
  if (role === "editor") {
    const svc = serviceClient();
    const { count } = await svc.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 });
    }
  }

  const svc = serviceClient();
  const { error } = await svc.from("org_members").update({ role }).eq("org_id", orgId).eq("user_id", targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/org/member — remove a member
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId, targetUserId } = await request.json();
  if (!orgId || !targetUserId) return NextResponse.json({ error: "orgId and targetUserId required" }, { status: 400 });

  if (!(await requireAdmin(user.id, orgId))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Last-admin guard — check if target is an admin before counting
  const svc2 = serviceClient();
  const { data: targetMember } = await svc2.from("org_members").select("role").eq("org_id", orgId).eq("user_id", targetUserId).maybeSingle();
  if (targetMember?.role === "admin") {
    const { count } = await svc2.from("org_members").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "Cannot remove the last admin. Promote another member first." }, { status: 400 });
    }
  }

  const svc = serviceClient();
  const { error } = await svc.from("org_members").delete().eq("org_id", orgId).eq("user_id", targetUserId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
