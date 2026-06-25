import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`org-invite:${user.id}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many invites sent. Please try again later." }, { status: 429 });
  }

  const { email: rawEmail, orgId, role: rawRole } = await request.json();
  if (!rawEmail || !orgId) return NextResponse.json({ error: "email and orgId required" }, { status: 400 });
  const invitedRole: "admin" | "editor" = rawRole === "admin" ? "admin" : "editor";
  if (typeof rawEmail !== "string" || rawEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  // Store lowercase so auto-accept lookups (which compare lowercased) match
  const email = rawEmail.trim().toLowerCase();

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the requesting user is an admin of this org
  const { data: membership } = await serviceClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Check not already a member
  const { data: orgProfile } = await serviceClient
    .from("organizer_profiles")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: existingUser } = await serviceClient
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMember } = await serviceClient
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", existingUser.id)
      .maybeSingle();
    if (existingMember) {
      return NextResponse.json({ error: "This person is already a team member" }, { status: 400 });
    }
  }

  // Upsert invite (resend resets token + expiry)
  const newToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: inviteError } = await serviceClient
    .from("org_invites")
    .upsert(
      { org_id: orgId, email, token: newToken, invited_by: user.id, expires_at: expiresAt, accepted_at: null, invited_role: invitedRole },
      { onConflict: "org_id,email", ignoreDuplicates: false }
    );

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  const orgName = orgProfile?.name ?? "a litly organization";
  const joinUrl = `https://thelitlyapp.com/join?invite=${newToken}`;

  try {
    await sendEmail({
    to: email,
    subject: `You've been invited to manage ${orgName} on litly`,
    text: `You've been invited to join ${orgName} as ${invitedRole === "admin" ? "an admin" : "an editor"} on litly.\n\nAccept your invitation: ${joinUrl}\n\nThis link expires in 7 days.`,
    html: emailWrapper(`
      <h1 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;margin:0 0 8px;color:#1B2A3E">You're invited to join ${escapeHtml(orgName)}</h1>
      <p style="color:#5a4a3a;margin:0 0 24px">
        You've been invited to help manage <strong>${escapeHtml(orgName)}</strong> on litly as ${invitedRole === "admin" ? "an <strong>admin</strong> — you'll be able to manage team members, edit the org profile, and post events" : "an <strong>editor</strong> — you'll be able to post and edit events for this organization"}.
      </p>
      <a href="${joinUrl}"
         style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;
                text-decoration:none;font-size:14px;font-weight:600">
        Accept invitation
      </a>
      <p style="margin-top:32px;font-size:12px;color:#7a6a5a">
        This link expires in 7 days. If you didn't expect this invitation, you can ignore it.
      </p>
    `),
    });
  } catch (emailError) {
    console.error("[org/invite] invite saved but email failed:", emailError);
    return NextResponse.json(
      { error: "The invite was saved, but the email failed to send. Click invite again to resend it." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/org/invite — revoke a pending invite
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId, orgId } = await request.json();
  if (!inviteId || !orgId) return NextResponse.json({ error: "inviteId and orgId required" }, { status: 400 });

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: membership } = await serviceClient
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { error } = await serviceClient
    .from("org_invites")
    .delete()
    .eq("id", inviteId)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
