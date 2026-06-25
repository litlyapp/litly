import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseFeed, mapToEventRow } from "@/lib/icalFeed";
import { sendEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
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

// Resolve the org's owner email the same way weekly-digest does: prefer the
// organizer_profiles.user_id, fall back to an org_members admin for shared orgs.
async function resolveOrgEmail(
  supabase: SupabaseClient,
  org: { id: string; user_id: string | null }
): Promise<string | undefined> {
  if (org.user_id) {
    const { data } = await supabase.auth.admin.getUserById(org.user_id);
    return data?.user?.email;
  }
  const { data: adminMember } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("org_id", org.id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (!adminMember?.user_id) return undefined;
  const { data } = await supabase.auth.admin.getUserById(adminMember.user_id);
  return data?.user?.email;
}

async function notifyOrgOfSync(
  supabase: SupabaseClient,
  org: { id: string; name: string; user_id: string | null },
  newCount: number,
  incompleteCount: number,
  incompleteTitles: string[]
) {
  try {
    const email = await resolveOrgEmail(supabase, org);
    if (!email) return;

    const incompleteLines = incompleteTitles
      .slice(0, 10)
      .map((t) => `• ${t}`)
      .join("\n");
    const incompleteHtmlItems = incompleteTitles
      .slice(0, 10)
      .map((t) => `<li style="margin-bottom:6px">${escapeHtml(t)}</li>`)
      .join("");

    const subject =
      incompleteCount > 0
        ? `${newCount} new event${newCount !== 1 ? "s" : ""} synced — ${incompleteCount} of your synced events need a banner or ticket link`
        : `${newCount} new event${newCount !== 1 ? "s" : ""} synced from your calendar feed`;

    await sendEmail({
      to: email,
      subject,
      text: [
        `Hi ${org.name},`,
        ``,
        `${newCount} new event${newCount !== 1 ? "s" : ""} just synced from your calendar feed to litly.`,
        ``,
        ...(incompleteCount > 0
          ? [
              `Your calendar doesn't carry banner images or ticket links, so ${incompleteCount} of your synced events (old and new) are missing those details:`,
              ``,
              incompleteLines,
              ``,
              `Add a banner and ticket link from your dashboard so patrons get the full picture:`,
            ]
          : [`Review them on your dashboard:`]),
        `https://thelitlyapp.com/dashboard`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;margin:0 0 8px;color:#1B2A3E">${newCount} new event${newCount !== 1 ? "s" : ""} synced</h1>
        <p style="color:#5a4a3a;margin:0 0 20px">Hi ${escapeHtml(org.name)}, these just came in from your calendar feed.</p>
        ${
          incompleteCount > 0
            ? `
          <p style="color:#5a4a3a;margin:0 0 12px">Your calendar doesn't carry banner images or ticket links, so <strong>${incompleteCount}</strong> of your synced events (old and new) are missing those details:</p>
          <ul style="color:#1B2A3E;padding-left:18px;margin:0 0 24px">${incompleteHtmlItems}</ul>
        `
            : ""
        }
        <div style="margin-top:8px">
          <a href="https://thelitlyapp.com/dashboard" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View dashboard</a>
        </div>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">Sent automatically after each calendar feed sync.</p>
      `),
    });
  } catch (emailErr) {
    console.error(`sync-org-feeds: failed to notify org ${org.id}:`, emailErr);
  }
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
    .select("id, name, user_id, calendar_feed_url, calendar_feed_default_genre, website, default_banner_url")
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

      const parsed = await parseFeed(feedUrl, org.website as string | null);

      // Glitch guard: a previously-synced org returning ~no events on this run
      // is far more likely a feed outage than every event being deleted at once.
      if ((existing?.length ?? 0) > 0 && parsed.length === 0) {
        throw new Error("Feed returned no events (previous sync had events) — treating as a fetch glitch, not a deletion");
      }

      const defaultGenre = (org.calendar_feed_default_genre as Genre[] | null) ?? [];
      let synced = 0;
      // Map from external_uid → event row id for existing events
      const existingUidToId = new Map(
        (existing ?? []).filter((e) => e.external_uid).map((e) => [e.external_uid, e.id])
      );
      let newCount = 0;

      for (const item of parsed) {
        let coords: { lat: number; lng: number } | null = null;
        if (item.location_name) {
          coords = await geocode(item.location_name);
        }

        const row = mapToEventRow(item, { organizerId: org.id, defaultGenre, defaultBannerUrl: org.default_banner_url as string | null, coords });
        const isNew = !existingUidToId.has(item.uid);

        let opError: { message: string } | null = null;
        if (isNew) {
          // New events from the feed land as drafts — org must approve before they go live
          const { error } = await supabase.from("events").insert({ ...row, is_published: false });
          opError = error;
        } else {
          // Existing events: update without touching is_published so org-published events stay live
          const existingId = existingUidToId.get(item.uid)!;
          const { error } = await supabase.from("events").update(row).eq("id", existingId);
          opError = error;
        }

        if (opError) {
          console.error(`sync-org-feeds: ${isNew ? "insert" : "update"} failed for org ${org.id} uid ${item.uid}:`, opError.message);
          continue;
        }
        synced++;

        if (isNew) newCount++;
      }

      // Cancel sweep: previously-synced events no longer present in the feed
      const freshUids = new Set(parsed.map((p) => p.uid));
      const toCancel = (existing ?? [])
        .filter((e) => e.external_uid && !freshUids.has(e.external_uid))
        .map((e) => e.id);

      if (toCancel.length > 0) {
        await supabase.from("events").update({ is_cancelled: true }).in("id", toCancel);
      }

      // Apply org default banner to any synced events still missing one
      if (org.default_banner_url) {
        await supabase
          .from("events")
          .update({ banner_url: org.default_banner_url })
          .eq("organizer_id", org.id)
          .eq("is_imported", true)
          .is("banner_url", null);
      }

      await supabase
        .from("organizer_profiles")
        .update({
          calendar_feed_last_synced_at: new Date().toISOString(),
          calendar_feed_last_status: "success",
          calendar_feed_last_error: null,
        })
        .eq("id", org.id);

      if (newCount > 0) {
        // Email lists every currently-incomplete feed-synced event, not just
        // the ones added in this batch — an org should see the full backlog
        // each time, not just what's new today.
        const { data: liveEvents } = await supabase
          .from("events")
          .select("title, event_type, ticket_url, virtual_url")
          .eq("feed_source_organizer_id", org.id)
          .eq("is_cancelled", false)
          .eq("is_published", true);

        const incomplete = (liveEvents ?? []).filter((e) =>
          e.event_type === "in_person" ? !e.ticket_url : !e.virtual_url
        );

        await notifyOrgOfSync(supabase, org, newCount, incomplete.length, incomplete.map((e) => e.title));
      }

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
