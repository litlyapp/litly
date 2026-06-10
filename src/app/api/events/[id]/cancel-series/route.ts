import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendBatchEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";
import { getEmailsByUserIds } from "@/lib/userEmails";

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

    // One RSVP per user (their next upcoming occurrence) determines the
    // date/time shown in their email, substituted via recipient-variables.
    const firstRsvpByUser = new Map<string, string>();
    for (const rsvp of rsvps ?? []) {
      if (!firstRsvpByUser.has(rsvp.user_id)) firstRsvpByUser.set(rsvp.user_id, rsvp.event_id);
    }

    const emailMap = await getEmailsByUserIds(serviceClient, firstRsvpByUser.keys());

    const seenEmails = new Set<string>();
    const recipients: { email: string; vars: Record<string, string> }[] = [];
    for (const [userId, eventId] of firstRsvpByUser) {
      const email = emailMap.get(userId);
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const eventForRsvp = toCancel.find((e) => e.id === eventId) ?? toCancel[0];
      const date = formatEventDate(eventForRsvp.date_time, eventForRsvp.timezone);
      const time = formatEventTime(eventForRsvp.date_time, eventForRsvp.timezone);
      const location = eventForRsvp.event_type === "virtual"
        ? "Virtual event"
        : [eventForRsvp.location_name, eventForRsvp.city, eventForRsvp.state].filter(Boolean).join(", ") || "Location TBD";

      recipients.push({
        email,
        vars: {
          date,
          time,
          location,
          dateHtml: escapeHtml(date),
          timeHtml: escapeHtml(time),
          locationHtml: escapeHtml(location),
        },
      });
    }

    await sendBatchEmail({
      recipients,
      subject: `Cancelled: ${ev.title} (series)`,
      text: [
        `We're sorry — the ${ev.title} series has been cancelled.`,
        ``,
        `Your RSVP for %recipient.date% at %recipient.time% (%recipient.location%) has been cancelled.`,
        ``,
        `Browse other upcoming events: https://thelitlyapp.com/events`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-size:22px;margin:0 0 8px;color:#1B2A3E">Series cancelled</h1>
        <p style="color:#5a4a3a;margin:0 0 20px">We're sorry — <strong>${escapeHtml(ev.title)}</strong> has been cancelled.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#7a6a5a;width:110px">Date</td><td style="padding:8px 0;color:#1B2A3E">%recipient.dateHtml%</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">%recipient.timeHtml%</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">%recipient.locationHtml%</td></tr>
        </table>
        <a href="https://thelitlyapp.com/events" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">Browse events</a>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
      `),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, cancelled: cancelIds.length });
}
