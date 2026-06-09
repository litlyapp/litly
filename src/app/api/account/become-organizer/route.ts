import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { orgName, orgType, bio, website } = body;

  if (!orgName || !orgType) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Update role in users table
  const { error: roleError } = await serviceClient
    .from("users")
    .update({ role: "organizer" })
    .eq("id", user.id);
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  // Check if the user already owns an org (has a profile with their user_id).
  // If so, additional orgs are created without user_id to avoid the unique constraint —
  // membership is tracked via org_members regardless.
  const { data: existingProfile } = await serviceClient
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isFirstOrg = !existingProfile;

  // Create organizer profile
  const { data: newProfile, error: profileError } = await serviceClient
    .from("organizer_profiles")
    .insert({
      ...(isFirstOrg ? { user_id: user.id } : {}),
      name: orgName,
      org_type: orgType,
      bio: bio || null,
      website: website || null,
    })
    .select("id")
    .single();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  // Make them the admin of their new org
  const { error: memberError } = await serviceClient
    .from("org_members")
    .upsert({ org_id: newProfile.id, user_id: user.id, role: "admin" }, { onConflict: "org_id,user_id", ignoreDuplicates: false });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  // Update auth metadata so future sessions reflect the new role
  await serviceClient.auth.admin.updateUserById(user.id, {
    user_metadata: { role: "organizer" },
  });

  return NextResponse.json({ ok: true, orgId: newProfile.id });
}
