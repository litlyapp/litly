import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { EmailOtpType, User } from "@supabase/supabase-js";

async function maybeCreateOrganizerProfile(user: User) {
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch fresh metadata via admin API — user.user_metadata from PKCE flow is unreliable
  const { data: adminData } = await serviceClient.auth.admin.getUserById(user.id);
  const meta = adminData?.user?.user_metadata ?? user.user_metadata;

  // Gate on metadata role, with users table as fallback
  let isOrganizer = meta?.role === "organizer";
  if (!isOrganizer) {
    const { data: userRow } = await serviceClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    isOrganizer = userRow?.role === "organizer";
  }
  if (!isOrganizer) return;

  // Skip if profile already exists
  const { data: existing } = await serviceClient
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return;

  const { error } = await serviceClient.from("organizer_profiles").insert({
    user_id: user.id,
    org_type: meta?.org_type ?? "individual",
    name: meta?.org_name ?? meta?.display_name ?? "Organizer",
    bio: meta?.bio ?? null,
    website: meta?.website ?? null,
  });

  if (error) console.error("[auth/callback] organizer_profiles insert failed:", error);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

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
