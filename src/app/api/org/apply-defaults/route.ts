import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await req.json();
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  // Verify membership
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch org defaults (default_banner_url added via migration)
  const { data: org } = await db
    .from("organizer_profiles")
    .select("default_banner_url")
    .eq("id", orgId)
    .single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const results: Record<string, number> = {};

  if (org.default_banner_url) {
    const { error } = await supabase
      .from("events")
      .update({ banner_url: org.default_banner_url as string })
      .eq("organizer_id", orgId)
      .eq("is_imported", true)
      .is("banner_url", null);
    if (!error) results.bannerApplied = 1;
  }

  return NextResponse.json({ ok: true, ...results });
}
