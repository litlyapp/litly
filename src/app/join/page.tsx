import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { ACTIVE_ORG_COOKIE } from "@/lib/activeOrg";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  if (!token) redirect("/");

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invite } = await svc
    .from("org_invites")
    .select("id, org_id, email, expires_at, accepted_at, invited_role, organizer_profiles(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl text-cream mb-4">Invalid invitation</h1>
          <p className="text-cream-muted mb-6">
            This invite link has expired or already been used.
          </p>
          <Link href="/" className="text-orange hover:text-orange/80 transition">
            Go to litly →
          </Link>
        </div>
      </div>
    );
  }

  const orgProfiles = invite.organizer_profiles as unknown as { name: string }[] | { name: string } | null;
  const orgName = (Array.isArray(orgProfiles) ? orgProfiles[0] : orgProfiles)?.name ?? "a litly organization";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Logged-in path: auto-accept if email matches
  if (user) {
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-3xl text-cream mb-4">Wrong account</h1>
            <p className="text-cream-muted mb-2">
              This invite was sent to <strong className="text-cream">{invite.email}</strong>.
            </p>
            <p className="text-cream-muted mb-6">
              You&apos;re currently signed in as <strong className="text-cream">{user.email}</strong>.
              Sign in with the correct account to accept this invitation.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(`/join?invite=${token}`)}`}
              className="inline-block bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
            >
              Sign in with a different account
            </Link>
          </div>
        </div>
      );
    }

    // Accept invite
    const { error: memberError } = await svc
      .from("org_members")
      .upsert({ org_id: invite.org_id, user_id: user.id, role: (invite as typeof invite & { invited_role?: string }).invited_role === "admin" ? "admin" : "editor" }, { onConflict: "org_id,user_id", ignoreDuplicates: true });

    if (memberError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="font-serif text-3xl text-cream mb-4">Something went wrong</h1>
            <p className="text-cream-muted mb-6">We couldn&apos;t add you to the organization. Please try again or contact support.</p>
            <Link href="/" className="text-orange hover:text-orange/80 transition">Go to litly →</Link>
          </div>
        </div>
      );
    }

    const { error: acceptError } = await svc.from("org_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    if (acceptError) {
      console.error("[join] Failed to mark invite accepted:", acceptError);
      // Non-fatal — membership was already added; continue
    }

    // Ensure organizer role
    const { data: userRow } = await svc.from("users").select("role").eq("id", user.id).single();
    if (userRow?.role !== "organizer") {
      await svc.from("users").update({ role: "organizer" }).eq("id", user.id);
      await svc.auth.admin.updateUserById(user.id, { user_metadata: { role: "organizer" } });
    }

    // Switch active org cookie to the newly joined org
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, invite.org_id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });

    redirect("/dashboard?joined=1");
  }

  // Not logged in — show landing
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-4xl text-cream mb-3">Join {orgName}</h1>
        <p className="text-cream-muted mb-8">
          You&apos;ve been invited to help manage <strong className="text-cream">{orgName}</strong> on litly.
          Sign in or create an account to accept.
        </p>

        <div className="space-y-3">
          <Link
            href={`/login?next=${encodeURIComponent(`/join?invite=${token}`)}`}
            className="block w-full bg-orange text-cream font-semibold py-3 rounded-full hover:bg-orange/90 transition text-sm text-center"
          >
            Sign in to accept
          </Link>
          <Link
            href={`/register?invite=${token}`}
            className="block w-full border border-cream/20 text-cream font-medium py-3 rounded-full hover:border-cream/40 transition text-sm text-center"
          >
            Create a new account
          </Link>
        </div>

        <p className="text-cream-muted text-xs mt-6">
          This invitation was sent to <strong className="text-cream">{invite.email}</strong>.
        </p>
      </div>
    </div>
  );
}
