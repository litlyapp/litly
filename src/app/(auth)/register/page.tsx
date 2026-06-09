import { createClient as createServiceClient } from "@supabase/supabase-js";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  let inviteInfo: { token: string; orgName: string } | null = null;

  if (token) {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await svc
      .from("org_invites")
      .select("token, expires_at, accepted_at, organizer_profiles(name)")
      .eq("token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data) {
      const orgProfiles = data.organizer_profiles as unknown as { name: string }[] | { name: string } | null;
      const orgName = (Array.isArray(orgProfiles) ? orgProfiles[0] : orgProfiles)?.name ?? "a litly organization";
      inviteInfo = { token, orgName };
    }
  }

  return <RegisterForm invite={inviteInfo} />;
}
