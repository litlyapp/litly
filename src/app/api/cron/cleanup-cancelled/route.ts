import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Hard-deletes cancelled events once their date has passed. Cancelled events
// are already hidden from every public surface; this stops them lingering in
// the DB and cluttering org dashboards forever. Past *non-cancelled* events are
// intentionally kept (they're hidden publicly but useful for history).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const nowIso = now.toISOString();

  // Cancelled events whose start time is in the past
  const { data: cancelled, error } = await supabase
    .from("events")
    .select("id, date_time, end_time, parent_event_id")
    .eq("is_cancelled", true)
    .lt("date_time", nowIso);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Respect end_time when present so an in-progress event isn't deleted mid-run
  const passedIds = (cancelled ?? [])
    .filter((e) => new Date(e.end_time ?? e.date_time) < now)
    .map((e) => e.id);
  if (passedIds.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  // Never delete a row still referenced as a parent by an existing event (a
  // cancelled series parent whose future occurrences haven't passed yet). Its
  // children get removed first; the now-childless parent clears on a later run.
  const { data: childRefs } = await supabase
    .from("events")
    .select("parent_event_id")
    .in("parent_event_id", passedIds);
  const stillParent = new Set((childRefs ?? []).map((c) => c.parent_event_id));
  const deletable = passedIds.filter((id) => !stillParent.has(id));
  if (deletable.length === 0) return NextResponse.json({ ok: true, deleted: 0 });

  // Clear dependent rows first to avoid foreign-key violations
  await supabase.from("rsvps").delete().in("event_id", deletable);
  await supabase.from("saved_events").delete().in("event_id", deletable);

  const { data: deleted, error: delError } = await supabase
    .from("events")
    .delete()
    .in("id", deletable)
    .select("id");
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: deleted?.length ?? 0 });
}
