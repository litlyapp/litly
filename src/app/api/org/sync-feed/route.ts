import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { parseFeed, mapToEventRow } from "@/lib/icalFeed";
import type { Genre } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // best-effort
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { orgId } = await request.json();
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  // Must be an org admin
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch the org profile (need service role to read user_id for email resolution)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org, error: orgError } = await (service as any)
    .from("organizer_profiles")
    .select("id, name, calendar_feed_url, calendar_feed_default_genre, website, default_banner_url")
    .eq("id", orgId)
    .maybeSingle();

  if (orgError || !org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const feedUrl = org.calendar_feed_url as string | null;
  if (!feedUrl) {
    return NextResponse.json({ error: "No calendar feed URL set" }, { status: 400 });
  }

  try {
    // Existing feed-sourced events for this org
    const { data: existing } = await service
      .from("events")
      .select("id, external_uid")
      .eq("feed_source_organizer_id", orgId)
      .eq("is_cancelled", false);

    const parsed = await parseFeed(feedUrl, org.website as string | null);

    const defaultGenre = (org.calendar_feed_default_genre as Genre[] | null) ?? [];
    const existingUidToId = new Map(
      (existing ?? []).filter((e: { external_uid: string | null }) => e.external_uid)
        .map((e: { external_uid: string; id: string }) => [e.external_uid, e.id])
    );

    let synced = 0;
    let newCount = 0;

    for (const item of parsed) {
      let coords: { lat: number; lng: number } | null = null;
      if (item.location_name) {
        coords = await geocode(item.location_name);
      }

      const row = mapToEventRow(item, {
        organizerId: orgId,
        defaultGenre,
        defaultBannerUrl: org.default_banner_url as string | null,
        coords,
      });

      const isNew = !existingUidToId.has(item.uid);

      if (isNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (service as any).from("events").insert({ ...row, is_published: false });
        if (error) {
          console.error(`sync-feed: insert failed for org ${orgId} uid ${item.uid}:`, error.message);
          continue;
        }
        newCount++;
      } else {
        const existingId = existingUidToId.get(item.uid)!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (service as any).from("events").update(row).eq("id", existingId);
        if (error) {
          console.error(`sync-feed: update failed for org ${orgId} uid ${item.uid}:`, error.message);
          continue;
        }
      }
      synced++;
    }

    // Cancel sweep: events no longer in the feed
    const freshUids = new Set(parsed.map((p) => p.uid));
    const toCancel = (existing ?? [])
      .filter((e: { external_uid: string | null; id: string }) => e.external_uid && !freshUids.has(e.external_uid))
      .map((e: { id: string }) => e.id);

    if (toCancel.length > 0) {
      await service.from("events").update({ is_cancelled: true }).in("id", toCancel);
    }

    // Apply default banner to synced events still missing one
    if (org.default_banner_url) {
      await service
        .from("events")
        .update({ banner_url: org.default_banner_url })
        .eq("organizer_id", orgId)
        .eq("is_imported", true)
        .is("banner_url", null);
    }

    await service
      .from("organizer_profiles")
      .update({
        calendar_feed_last_synced_at: new Date().toISOString(),
        calendar_feed_last_status: "success",
        calendar_feed_last_error: null,
      })
      .eq("id", orgId);

    return NextResponse.json({ ok: true, synced, newCount, cancelled: toCancel.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    await service
      .from("organizer_profiles")
      .update({
        calendar_feed_last_synced_at: new Date().toISOString(),
        calendar_feed_last_status: "error",
        calendar_feed_last_error: message.slice(0, 500),
      })
      .eq("id", orgId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
