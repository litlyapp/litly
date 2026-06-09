import { cookies } from "next/headers";

export const ACTIVE_ORG_COOKIE = "litly_active_org";

// Returns the verified active org ID from cookie, falling back to first membership org.
export async function getActiveOrgId(orgIds: string[]): Promise<string | null> {
  if (orgIds.length === 0) return null;
  const cookieStore = await cookies();
  const stored = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  if (stored && orgIds.includes(stored)) return stored;
  return orgIds[0];
}
