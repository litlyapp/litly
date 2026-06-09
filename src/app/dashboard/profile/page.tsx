import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrgId } from "@/lib/activeOrg";
import ProfileEditForm from "./ProfileEditForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/profile");

  // Load the active org (admin only can edit profile)
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) redirect("/dashboard");

  const orgIds = memberships.map((m) => m.org_id);
  const activeOrgId = await getActiveOrgId(orgIds);
  const activeMembership = memberships.find((m) => m.org_id === activeOrgId);

  if (activeMembership?.role !== "admin") redirect("/dashboard");

  const { data: profileRaw } = await supabase
    .from("organizer_profiles")
    .select("*")
    .eq("id", activeOrgId!)
    .maybeSingle();

  if (!profileRaw) redirect("/dashboard");

  const profile = profileRaw as typeof profileRaw & { avatar_url: string | null };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Edit profile</h1>
        <p className="text-cream-muted">Update your public organizer profile.</p>
      </div>
      <ProfileEditForm profile={profile} />

      <div className="mt-10 pt-6 border-t border-cream/10 text-center">
        <p className="text-cream-muted text-sm mb-2">Password, email, and account settings</p>
        <Link
          href="/account"
          className="text-orange hover:text-orange/80 text-sm underline underline-offset-2 transition"
        >
          Manage your account →
        </Link>
      </div>
    </div>
  );
}
