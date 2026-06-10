import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve auth user ids → email addresses in bulk via paginated
 * auth.admin.listUsers, instead of one admin.getUserById call per user.
 * Requires a service-role client.
 */
export async function getEmailsByUserIds(
  serviceClient: SupabaseClient,
  userIds: Iterable<string>
): Promise<Map<string, string>> {
  const wanted = new Set(userIds);
  const emails = new Map<string, string>();
  if (wanted.size === 0) return emails;

  let page = 1;
  // Hard cap of 100 pages (100k users) as a safety valve against runaway loops
  while (page <= 100) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[getEmailsByUserIds] listUsers failed:", error);
      break;
    }
    for (const u of data.users) {
      if (wanted.has(u.id) && u.email) emails.set(u.id, u.email);
    }
    if (emails.size >= wanted.size || data.users.length < 1000) break;
    page++;
  }

  return emails;
}
