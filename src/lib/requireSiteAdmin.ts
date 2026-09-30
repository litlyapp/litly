import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/curatedOrg";

/**
 * Server-side gate for /admin pages: must be signed in as the site-admin
 * account. Logged-out visitors go to login; anyone else gets a 404 so the
 * admin pages aren't advertised. Returns the admin's Supabase client.
 */
export async function requireSiteAdmin(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (user.email?.toLowerCase() !== ADMIN_EMAIL) notFound();
  return supabase;
}
