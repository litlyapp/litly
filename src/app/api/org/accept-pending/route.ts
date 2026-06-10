import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptPendingInvites } from "@/lib/acceptInvites";

// POST /api/org/accept-pending — accept any pending org invites for the
// logged-in user's email. Called after login as a safety net, because the
// signup-confirmation callback doesn't run when the confirmation link is
// opened on a different device or prefetched by the email client.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accepted = await acceptPendingInvites(user);
  return NextResponse.json({ ok: true, accepted });
}
