import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileEditForm from "./ProfileEditForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/profile");

  const { data: profileRaw } = await supabase
    .from("organizer_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profileRaw) redirect("/");

  const profile = profileRaw as typeof profileRaw & { avatar_url: string | null };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Edit profile</h1>
        <p className="text-cream-muted">Update your public organizer profile.</p>
      </div>
      <ProfileEditForm profile={profile} />
    </div>
  );
}
