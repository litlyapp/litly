import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateNextOccurrence } from "@/lib/recurrence";
import type { RecurrenceRule } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // Retire cancelled events whose date has passed (folded in from the former
  // standalone cleanup-cancelled cron). Runs before the series work so it
  // happens even when there are no recurring series to process. Cancelled
  // events are already hidden everywhere public; this stops them lingering in
  // the DB and on org dashboards. Past *non-cancelled* events are kept.
  let deletedCancelled = 0;
  // Isolated so a cleanup failure can never abort the recurring-series top-up below.
  try {
    const nowDate = new Date();
    const { data: cancelled } = await supabase
      .from("events")
      .select("id, date_time, end_time, parent_event_id")
      .eq("is_cancelled", true)
      .lt("date_time", now);
    const passedIds = (cancelled ?? [])
      .filter((e) => new Date(e.end_time ?? e.date_time) < nowDate)
      .map((e) => e.id);
    if (passedIds.length > 0) {
      // Never delete a row still referenced as a parent by an existing event
      // (a cancelled series parent whose future occurrences haven't passed);
      // it clears on a later run once childless.
      const { data: childRefs } = await supabase
        .from("events")
        .select("parent_event_id")
        .in("parent_event_id", passedIds);
      const stillParent = new Set((childRefs ?? []).map((c) => c.parent_event_id));
      const deletable = passedIds.filter((id) => !stillParent.has(id));
      if (deletable.length > 0) {
        // Clear dependent rows first to avoid foreign-key violations
        await supabase.from("rsvps").delete().in("event_id", deletable);
        await supabase.from("saved_events").delete().in("event_id", deletable);
        const { data: deleted } = await supabase
          .from("events")
          .delete()
          .in("id", deletable)
          .select("id");
        deletedCancelled = deleted?.length ?? 0;
      }
    }
  } catch (cleanupErr) {
    console.error("daily-series: cleanup-cancelled step failed (series top-up still proceeds):", cleanupErr);
  }

  // Find all ongoing parent events with a recurrence rule
  const { data: parents, error } = await supabase
    .from("events")
    .select("id, organizer_id, date_time, end_time, recurrence_rule, series_end_date, is_cancelled, title, description, genre, event_type, location_name, address, city, state, country, lat, lng, virtual_url, open_mic, featured_readers, rsvp_enabled, banner_url, ticket_url, ticket_type, is_imported, source_url, source_name")
    .eq("is_ongoing", true)
    .not("recurrence_rule", "is", null);

  if (error) {
    console.error("daily-series cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!parents || parents.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, added: 0, deletedCancelled });
  }

  let totalAdded = 0;

  for (const parent of parents) {
    if (parent.is_cancelled) continue;

    const rule = parent.recurrence_rule as RecurrenceRule;
    const seriesEndDate = parent.series_end_date ? new Date(parent.series_end_date + "T23:59:59") : null;

    // Count upcoming non-cancelled occurrences in this series
    const { count: upcomingCount, error: countError } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("parent_event_id", parent.id)
      .eq("is_cancelled", false)
      .gte("date_time", now);

    if (countError) {
      console.error(`Failed to count occurrences for series ${parent.id}:`, countError.message);
      continue; // skip rather than assuming needed = 10
    }

    const needed = 10 - (upcomingCount ?? 0);
    if (needed <= 0) continue;

    // Find the last existing occurrence (parent or child)
    const { data: lastChild } = await supabase
      .from("events")
      .select("date_time, end_time")
      .eq("parent_event_id", parent.id)
      .order("date_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    const parentStart = new Date(parent.date_time);
    const lastDate = lastChild ? new Date(lastChild.date_time) : parentStart;

    const durationMs =
      parent.end_time
        ? new Date(parent.end_time).getTime() - parentStart.getTime()
        : null;

    // Generate up to `needed` new occurrences
    let cursor = lastDate;
    let added = 0;

    while (added < needed) {
      const next = generateNextOccurrence(cursor, rule);
      if (!next) break;
      if (seriesEndDate && next > seriesEndDate) break;

      const { error: insertError } = await supabase.from("events").insert({
        organizer_id: parent.organizer_id,
        parent_event_id: parent.id,
        title: parent.title,
        description: parent.description,
        genre: parent.genre,
        event_type: parent.event_type,
        date_time: next.toISOString(),
        end_time: durationMs !== null ? new Date(next.getTime() + durationMs).toISOString() : null,
        location_name: parent.location_name,
        address: parent.address,
        city: parent.city,
        state: parent.state,
        country: parent.country,
        lat: parent.lat,
        lng: parent.lng,
        virtual_url: parent.virtual_url,
        open_mic: parent.open_mic,
        featured_readers: parent.featured_readers,
        rsvp_enabled: parent.rsvp_enabled,
        banner_url: parent.banner_url,
        ticket_url: parent.ticket_url,
        ticket_type: parent.ticket_type,
        is_imported: parent.is_imported,
        source_url: parent.source_url,
        source_name: parent.source_name,
        recurrence_rule: null,
        is_ongoing: false,
      });

      if (insertError) {
        console.error(`Failed to insert occurrence for series ${parent.id}:`, insertError.message);
        break;
      }

      cursor = next;
      added++;
    }

    totalAdded += added;
  }

  return NextResponse.json({ ok: true, processed: parents.length, added: totalAdded, deletedCancelled });
}
