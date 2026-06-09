import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { EmailOtpType, User } from "@supabase/supabase-js";

async function maybeCreateOrganizerProfile(user: User) {
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch fresh metadata via admin API — user.user_metadata from PKCE flow is unreliable
  const { data: adminData } = await svc.auth.admin.getUserById(user.id);
  const meta = adminData?.user?.user_metadata ?? user.user_metadata;

  // Gate on metadata role, with users table as fallback
  let isOrganizer = meta?.role === "organizer";
  if (!isOrganizer) {
    const { data: userRow } = await svc.from("users").select("role").eq("id", user.id).single();
    isOrganizer = userRow?.role === "organizer";
  }
  if (!isOrganizer) {
    // Still check for pending invite — patron might have been invited to an org
    await maybeAcceptPendingInvite(user);
    return;
  }

  // Skip if profile already exists
  const { data: existing } = await svc
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let profileId: string | undefined = existing?.id;

  if (!existing) {
    const { data: newProfile, error } = await svc.from("organizer_profiles").insert({
      user_id: user.id,
      org_type: meta?.org_type ?? "individual",
      name: meta?.org_name ?? meta?.display_name ?? "Organizer",
      bio: meta?.bio ?? null,
      website: meta?.website ?? null,
    }).select("id").single();

    if (error) { console.error("[auth/callback] organizer_profiles insert failed:", error); return; }
    profileId = newProfile.id;
  }

  // Ensure admin membership row exists
  if (profileId) {
    await svc.from("org_members").upsert(
      { org_id: profileId, user_id: user.id, role: "admin" },
      { onConflict: "org_id,user_id", ignoreDuplicates: true }
    );
  }

  await maybeAcceptPendingInvite(user);
}

async function maybeAcceptPendingInvite(user: User) {
  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  if (!user.email) return;
  const { data: invite } = await svc
    .from("org_invites")
    .select("id, org_id, expires_at")
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!invite) return;

  await svc.from("org_members").upsert(
    { org_id: invite.org_id, user_id: user.id, role: "editor" },
    { onConflict: "org_id,user_id", ignoreDuplicates: true }
  );
  await svc.from("org_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  // Ensure organizer role on the users table
  const { data: userRow } = await svc.from("users").select("role").eq("id", user.id).single();
  if (userRow?.role !== "organizer") {
    await svc.from("users").update({ role: "organizer" }).eq("id", user.id);
    await svc.auth.admin.updateUserById(user.id, { user_metadata: { role: "organizer" } });
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const supabase = await createClient();

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      if (data.user) await maybeCreateOrganizerProfile(data.user);
      return NextResponse.redirect(`${origin}/login?confirmed=1`);
    }
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await maybeCreateOrganizerProfile(data.user);
      // If no explicit next, treat as signup confirmation
      const redirectTo = next === "/" ? "/login?confirmed=1" : next;
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
