import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiError";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// DELETE /api/events/[id] — permanently delete an event (and, for a series
// parent, every occurrence). Callers cancel a live upcoming event first so
// RSVPd patrons get the cancellation email; see lib/events/deleteEvent.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: event } = await svc
      .from("events")
      .select("id, is_published, is_cancelled, organizer_id")
      .eq("id", id)
      .maybeSingle();

    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: membership } = await svc
      .from("org_members")
      .select("role")
      .eq("org_id", event.organizer_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // Drafts are anyone's to discard; published events follow the cancel rule
    if (event.is_published && membership.role !== "admin") {
      return NextResponse.json({ error: "Only org admins can delete published events." }, { status: 403 });
    }

    // Deleting a series parent removes all of its occurrences
    const { data: children } = await svc
      .from("events")
      .select("id")
      .eq("parent_event_id", id);
    const ids = [id, ...(children ?? []).map((c) => c.id)];

    // Clear dependent rows first to avoid foreign-key violations
    await svc.from("rsvps").delete().in("event_id", ids);
    await svc.from("saved_events").delete().in("event_id", ids);
    if (ids.length > 1) {
      const { error: childError } = await svc.from("events").delete().eq("parent_event_id", id);
      if (childError) return serverError("events/delete", childError);
    }

    const { error, count } = await svc.from("events").delete({ count: "exact" }).eq("id", id);
    if (error) return serverError("events/delete", error);
    if (!count) return NextResponse.json({ error: "Delete affected no rows" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("events/delete", err);
  }
}
