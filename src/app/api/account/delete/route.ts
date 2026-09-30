import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { listUserUploadUrls, orgImageUrls, removeUnreferencedUploads } from "@/lib/storageCleanup";

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Delete orgs this user is the last member of (and their events), per the
  // privacy policy: deleting an account removes "any organizations left
  // without other members". Orgs with other members survive —
  // organizer_profiles.user_id is ON DELETE SET NULL.
  const { data: memberships } = await serviceClient
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  // Images of deleted orgs, whoever uploaded them
  const orphanCandidates: string[] = [];

  for (const { org_id } of memberships ?? []) {
    const { count: otherMembers } = await serviceClient
      .from("org_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org_id)
      .neq("user_id", user.id);

    if ((otherMembers ?? 0) > 0) {
      // The org survives — make sure it isn't left without an admin. Promote
      // the longest-standing remaining member if this user was the only one.
      const { count: otherAdmins } = await serviceClient
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org_id)
        .eq("role", "admin")
        .neq("user_id", user.id);
      if ((otherAdmins ?? 0) === 0) {
        const { data: successor } = await serviceClient
          .from("org_members")
          .select("user_id")
          .eq("org_id", org_id)
          .neq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (successor) {
          await serviceClient
            .from("org_members")
            .update({ role: "admin" })
            .eq("org_id", org_id)
            .eq("user_id", successor.user_id);
        }
      }
      continue;
    }

    orphanCandidates.push(...(await orgImageUrls(serviceClient, org_id)));
    await serviceClient.from("events").delete().eq("organizer_id", org_id);
    await serviceClient.from("organizer_profiles").delete().eq("id", org_id);
  }

  // Remove the user's uploaded images (and deleted orgs' images) unless a
  // surviving org or event still uses them, per the privacy policy
  orphanCandidates.push(...(await listUserUploadUrls(serviceClient, user.id)));
  await removeUnreferencedUploads(serviceClient, orphanCandidates);

  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) return serverError("account/delete", error);

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
