import type { SupabaseClient } from "@supabase/supabase-js";

// Public buckets that hold user uploads, stored as {uploader_user_id}/{file}
const UPLOAD_BUCKETS = ["profile-avatars", "event-banners"] as const;

function publicUrl(bucket: string, path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

function parsePublicUrl(url: string): { bucket: string; path: string } | null {
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  if (!url.startsWith(prefix)) return null;
  const [bucket, ...rest] = url.slice(prefix.length).split("/");
  if (!(UPLOAD_BUCKETS as readonly string[]).includes(bucket) || rest.length === 0) return null;
  return { bucket, path: rest.join("/") };
}

async function isReferenced(svc: SupabaseClient, url: string): Promise<boolean> {
  const [avatar, banner, event] = await Promise.all([
    svc.from("organizer_profiles").select("id", { count: "exact", head: true }).eq("avatar_url", url),
    svc.from("organizer_profiles").select("id", { count: "exact", head: true }).eq("default_banner_url", url),
    svc.from("events").select("id", { count: "exact", head: true }).eq("banner_url", url),
  ]);
  return (avatar.count ?? 0) + (banner.count ?? 0) + (event.count ?? 0) > 0;
}

/**
 * Delete uploaded images (by public URL) that nothing references any more.
 * Call AFTER the rows that used them are gone. Images still used by a
 * surviving org or event are kept. Requires a service-role client.
 */
export async function removeUnreferencedUploads(svc: SupabaseClient, urls: Iterable<string>): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const url of new Set(urls)) {
    const parsed = parsePublicUrl(url);
    if (!parsed || (await isReferenced(svc, url))) continue;
    byBucket.set(parsed.bucket, [...(byBucket.get(parsed.bucket) ?? []), parsed.path]);
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const { error } = await svc.storage.from(bucket).remove(paths);
    if (error) console.error(`[storageCleanup] remove from ${bucket} failed:`, error);
    else removed += paths.length;
  }
  return removed;
}

/** Public URLs of every file a user uploaded, across the upload buckets. */
export async function listUserUploadUrls(svc: SupabaseClient, userId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const bucket of UPLOAD_BUCKETS) {
    const { data, error } = await svc.storage.from(bucket).list(userId, { limit: 1000 });
    if (error) {
      console.error(`[storageCleanup] list ${bucket}/${userId} failed:`, error);
      continue;
    }
    for (const file of data ?? []) urls.push(publicUrl(bucket, `${userId}/${file.name}`));
  }
  return urls;
}

/** Public URLs of an org's avatar, default banner, and event banners. */
export async function orgImageUrls(svc: SupabaseClient, orgId: string): Promise<string[]> {
  const [{ data: org }, { data: events }] = await Promise.all([
    svc.from("organizer_profiles").select("avatar_url, default_banner_url").eq("id", orgId).maybeSingle(),
    svc.from("events").select("banner_url").eq("organizer_id", orgId).not("banner_url", "is", null),
  ]);
  return [org?.avatar_url, org?.default_banner_url, ...(events ?? []).map((e) => e.banner_url)].filter(
    (u): u is string => !!u
  );
}
