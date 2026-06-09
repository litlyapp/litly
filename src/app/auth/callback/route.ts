import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";

async function maybeCreateOrganizerProfile(userId: string) {
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check the users table role (set by DB trigger on signup — more reliable than user_metadata timing)
  const { data: userRow } = await serviceClient
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (userRow?.role !== "organizer") return;

  // Skip if profile already exists
  const { data: existing } = await serviceClient
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;

  // Read metadata for org details
  const { data: userData } = await serviceClient.auth.admin.getUserById(userId);
  const meta = userData?.user?.user_metadata;

  await serviceClient.from("organizer_profiles").insert({
    user_id: userId,
    org_type: meta?.org_type ?? "individual",
    name: meta?.org_name ?? meta?.display_name ?? "Organizer",
    bio: meta?.bio ?? null,
    website: meta?.website ?? null,
  });
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
      if (type === "signup" && data.user) {
        await maybeCreateOrganizerProfile(data.user.id);
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }
      const redirectTo = type === "recovery" ? "/reset-password" : next;
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await maybeCreateOrganizerProfile(data.user.id);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
