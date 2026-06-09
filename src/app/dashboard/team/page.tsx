import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import TeamClient from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/team");

  // Must be admin of some org
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (!memberships || memberships.length === 0) redirect("/dashboard");

  const adminOrgId = memberships[0].org_id;

  const svc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: orgProfile }, { data: members }, { data: pendingInvites }] = await Promise.all([
    svc.from("organizer_profiles").select("name").eq("id", adminOrgId).single(),
    svc
      .from("org_members")
      .select("user_id, role, users(email, display_name)")
      .eq("org_id", adminOrgId)
      .order("created_at", { ascending: true }),
    svc
      .from("org_invites")
      .select("id, email, expires_at, created_at")
      .eq("org_id", adminOrgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-cream mb-1">Team</h1>
          <p className="text-cream-muted">{orgProfile?.name}</p>
        </div>
        <Link
          href="/dashboard"
          className="border border-cream/20 text-cream-muted font-medium px-4 py-2.5 rounded-full hover:border-cream/40 hover:text-cream transition text-sm"
        >
          ← Dashboard
        </Link>
      </div>

      <TeamClient
        orgId={adminOrgId}
        members={(members ?? []) as unknown as Parameters<typeof TeamClient>[0]["members"]}
        pendingInvites={pendingInvites ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
