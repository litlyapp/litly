import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch event first, then verify user is a member of the owning org
  const { data: thisEvent } = await supabase
    .from("events")
    .select("id, parent_event_id, organizer_id, title, date_time, timezone, location_name, city, state, event_type")
    .eq("id", id)
    .single();

  if (!thisEvent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", thisEvent.organizer_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only org admins can cancel events." }, { status: 403 });
  }

  const ev = thisEvent as typeof thisEvent & { parent_event_id: string | null };
  const parentId = ev.parent_event_id ?? ev.id;

  // Cancel the parent + all future non-cancelled children
  const now = new Date().toISOString();
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all upcoming siblings (children + parent if upcoming)
  const { data: siblings } = await serviceClient
    .from("events")
    .select("id, title, date_time, timezone, location_name, city, state, event_type")
    .eq("parent_event_id", parentId)
    .eq("is_cancelled", false)
    .gte("date_time", now);

  const { data: parentEvent } = await serviceClient
    .from("events")
    .select("id, title, date_time, timezone, location_name, city, state, event_type")
    .eq("id", parentId)
    .single();

  const toCancel = [
    ...(siblings ?? []),
    ...(parentEvent && parentEvent.date_time >= now ? [parentEvent] : []),
  ];

  const cancelIds = toCancel.map((e) => e.id);
  if (cancelIds.length > 0) {
    await serviceClient.from("events").update({ is_cancelled: true }).in("id", cancelIds);
  }

  // Notify all RSVPd patrons across all cancelled occurrences
  if (cancelIds.length > 0) {
    const { data: rsvps } = await serviceClient
      .from("rsvps")
      .select("user_id, event_id")
      .in("event_id", cancelIds);

    const notifiedUsers = new Set<string>();
    for (const rsvp of rsvps ?? []) {
      if (notifiedUsers.has(rsvp.user_id)) continue;
      notifiedUsers.add(rsvp.user_id);

      const { data: userData } = await serviceClient.auth.admin.getUserById(rsvp.user_id);
      const email = userData?.user?.email;
      if (!email) continue;

      const eventForRsvp = toCancel.find((e) => e.id === rsvp.event_id) ?? toCancel[0];
      const date = formatEventDate(eventForRsvp.date_time, eventForRsvp.timezone);
      const time = formatEventTime(eventForRsvp.date_time, eventForRsvp.timezone);
      const location = eventForRsvp.event_type === "virtual"
        ? "Virtual event"
        : [eventForRsvp.location_name, eventForRsvp.city, eventForRsvp.state].filter(Boolean).join(", ") || "Location TBD";

      await sendEmail({
        to: email,
        subject: `Cancelled: ${ev.title} (series)`,
        text: [
          `We're sorry — the ${ev.title} series has been cancelled.`,
          ``,
          `Your RSVP for ${date} at ${time} (${location}) has been cancelled.`,
          ``,
          `Browse other upcoming events: https://thelitlyapp.com/events`,
          ``,
          `— litly`,
        ].join("\n"),
        html: emailWrapper(`
          <h1 style="font-size:22px;margin:0 0 8px;color:#1B2A3E">Series cancelled</h1>
          <p style="color:#5a4a3a;margin:0 0 20px">We're sorry — <strong>${escapeHtml(ev.title)}</strong> has been cancelled.</p>
          <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
            <tr><td style="padding:8px 0;color:#7a6a5a;width:110px">Date</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(date)}</td></tr>
            <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(time)}</td></tr>
            <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(location)}</td></tr>
          </table>
          <a href="https://thelitlyapp.com/events" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">Browse events</a>
          <p style="margin-top:32px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
        `),
      }).catch(console.error);
    }
  }

  return NextResponse.json({ ok: true, cancelled: cancelIds.length });
}
