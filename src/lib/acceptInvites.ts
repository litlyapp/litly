import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/**
 * Accept all pending org invites matching the user's email. Idempotent.
 * Called from the auth callback (signup confirmation) AND at login — the
 * confirmation redirect is unreliable (different device, PKCE state missing,
 * link prefetching), so login is the safety net that always runs.
 * Returns the number of invites accepted.
 */
export async function acceptPendingInvites(user: User): Promise<number> {
  if (!user.email) return 0;

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: invites } = await svc
    .from("org_invites")
    .select("id, org_id, expires_at")
    .eq("email", user.email.toLowerCase())
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString());

  if (!invites || invites.length === 0) return 0;

  let accepted = 0;
  for (const invite of invites) {
    const { error: memberError } = await svc.from("org_members").upsert(
      { org_id: invite.org_id, user_id: user.id, role: "editor" },
      { onConflict: "org_id,user_id", ignoreDuplicates: true }
    );
    if (memberError) {
      console.error("[acceptPendingInvites] membership upsert failed:", memberError);
      continue;
    }
    await svc.from("org_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
    accepted++;
  }

  if (accepted > 0) {
    // Ensure organizer role on the users table + auth metadata
    const { data: userRow } = await svc.from("users").select("role").eq("id", user.id).single();
    if (userRow?.role !== "organizer") {
      await svc.from("users").update({ role: "organizer" }).eq("id", user.id);
      await svc.auth.admin.updateUserById(user.id, { user_metadata: { role: "organizer" } });
    }
  }

  return accepted;
}
