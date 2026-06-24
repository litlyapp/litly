import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseFeed, mapToEventRow } from "@/lib/icalFeed";
import type { Genre } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Best-effort server-side geocode so feed-synced events get a map pin
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // geocoding is best-effort
  }
  return null;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orgs, error: orgsError } = await supabase
    .from("organizer_profiles")
    .select("id, name, calendar_feed_url, calendar_feed_default_genre")
    .not("calendar_feed_url", "is", null);

  if (orgsError) {
    console.error("sync-org-feeds: failed to load orgs:", orgsError.message);
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const summary: Record<string, { synced?: number; cancelled?: number; error?: string }> = {};

  for (const org of orgs ?? []) {
    const feedUrl = org.calendar_feed_url as string;
    try {
      // Existing feed-sourced events, to size the glitch guard and run the cancel sweep
      const { data: existing, error: existingError } = await supabase
        .from("events")
        .select("id, external_uid")
        .eq("feed_source_organizer_id", org.id)
        .eq("is_cancelled", false);

      if (existingError) throw new Error(existingError.message);

      const parsed = await parseFeed(feedUrl);

      // Glitch guard: a previously-synced org returning ~no events on this run
      // is far more likely a feed outage than every event being deleted at once.
      if ((existing?.length ?? 0) > 0 && parsed.length === 0) {
        throw new Error("Feed returned no events (previous sync had events) — treating as a fetch glitch, not a deletion");
      }

      const defaultGenre = (org.calendar_feed_default_genre as Genre[] | null) ?? [];
      let synced = 0;

      for (const item of parsed) {
        let coords: { lat: number; lng: number } | null = null;
        if (item.location_name) {
          coords = await geocode(item.location_name);
        }

        const row = mapToEventRow(item, { organizerId: org.id, defaultGenre, coords });

        const { error: upsertError } = await supabase
          .from("events")
          .upsert(row, { onConflict: "organizer_id,external_uid" });

        if (upsertError) {
          console.error(`sync-org-feeds: upsert failed for org ${org.id} uid ${item.uid}:`, upsertError.message);
          continue;
        }
        synced++;
      }

      // Cancel sweep: previously-synced events no longer present in the feed
      const freshUids = new Set(parsed.map((p) => p.uid));
      const toCancel = (existing ?? [])
        .filter((e) => e.external_uid && !freshUids.has(e.external_uid))
        .map((e) => e.id);

      if (toCancel.length > 0) {
        await supabase.from("events").update({ is_cancelled: true }).in("id", toCancel);
      }

      await supabase
        .from("organizer_profiles")
        .update({
          calendar_feed_last_synced_at: new Date().toISOString(),
          calendar_feed_last_status: "success",
          calendar_feed_last_error: null,
        })
        .eq("id", org.id);

      summary[org.name] = { synced, cancelled: toCancel.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error(`sync-org-feeds: ${org.name} (${org.id}) failed:`, message);
      await supabase
        .from("organizer_profiles")
        .update({
          calendar_feed_last_synced_at: new Date().toISOString(),
          calendar_feed_last_status: "error",
          calendar_feed_last_error: message.slice(0, 500),
        })
        .eq("id", org.id);
      summary[org.name] = { error: message };
    }
  }

  return NextResponse.json({ ok: true, orgs: summary });
}
