import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// DELETE /api/org/delete — admin-only, permanently deletes an org and its events
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await request.json();
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const svc = serviceClient();

  const { data: membership } = await svc
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { error: eventsError } = await svc.from("events").delete().eq("organizer_id", orgId);
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const { error: orgError } = await svc.from("organizer_profiles").delete().eq("id", orgId);
  if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
