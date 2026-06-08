import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailWrapper } from "@/lib/sendEmail";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const since = new Date();
  since.setDate(since.getDate() - 7);

  // Fetch all RSVPs from the past 7 days with event + organizer info
  const { data: rsvps, error } = await supabase
    .from("rsvps")
    .select(`
      created_at,
      event:events(id, title, date_time, timezone, location_name, city, state, event_type,
        organizer:organizer_profiles(id, name, user_id)
      )
    `)
    .gte("created_at", since.toISOString());

  if (error) {
    console.error("Weekly digest error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rsvps || rsvps.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Group RSVPs by organizer
  const byOrganizer = new Map<string, {
    organizerId: string;
    organizerName: string;
    userId: string;
    events: Map<string, { title: string; date_time: string; location_name: string | null; city: string | null; state: string | null; event_type: string; count: number; eventId: string }>;
  }>();

  for (const rsvp of rsvps) {
    const event = Array.isArray(rsvp.event) ? rsvp.event[0] : rsvp.event;
    if (!event) continue;
    const organizer = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
    if (!organizer) continue;

    if (!byOrganizer.has(organizer.id)) {
      byOrganizer.set(organizer.id, {
        organizerId: organizer.id,
        organizerName: organizer.name,
        userId: organizer.user_id,
        events: new Map(),
      });
    }

    const org = byOrganizer.get(organizer.id)!;
    if (!org.events.has(event.id)) {
      org.events.set(event.id, {
        title: event.title,
        date_time: event.date_time,
        location_name: event.location_name,
        city: event.city,
        state: event.state,
        event_type: event.event_type,
        count: 0,
        eventId: event.id,
      });
    }
    org.events.get(event.id)!.count++;
  }

  // Fetch organizer emails from auth.users via service role
  let sent = 0;
  for (const org of byOrganizer.values()) {
    const { data: userData } = await supabase.auth.admin.getUserById(org.userId);
    const email = userData?.user?.email;
    if (!email) continue;

    const totalRsvps = Array.from(org.events.values()).reduce((sum, e) => sum + e.count, 0);
    const eventLines = Array.from(org.events.values())
      .map((e) => {
        const loc = e.event_type === "virtual"
          ? "Virtual"
          : [e.location_name, e.city, e.state].filter(Boolean).join(", ") || "Location TBD";
        return `• ${e.title} — ${formatEventDate(e.date_time, e.timezone)} at ${formatEventTime(e.date_time, e.timezone)} (${loc}): ${e.count} new RSVP${e.count !== 1 ? "s" : ""}`;
      })
      .join("\n");

    const eventHtmlRows = Array.from(org.events.values())
      .map((e) => {
        const loc = e.event_type === "virtual"
          ? "Virtual"
          : [e.location_name, e.city, e.state].filter(Boolean).join(", ") || "Location TBD";
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5">
              <a href="https://thelitlyapp.com/events/${e.eventId}" style="color:#1B2A3E;font-weight:600;text-decoration:none">${e.title}</a><br/>
              <span style="color:#7a6a5a;font-size:13px">${formatEventDate(e.date_time, e.timezone)} · ${loc}</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #d4c9b5;text-align:right;white-space:nowrap">
              <strong style="color:#E8622A">${e.count} new RSVP${e.count !== 1 ? "s" : ""}</strong>
            </td>
          </tr>`;
      })
      .join("");

    await sendEmail({
      to: email,
      subject: `Your weekly litly digest — ${totalRsvps} new RSVP${totalRsvps !== 1 ? "s" : ""}`,
      text: [
        `Hi ${org.organizerName},`,
        ``,
        `Here's your weekly RSVP summary from litly:`,
        ``,
        eventLines,
        ``,
        `View your dashboard: https://thelitlyapp.com/dashboard`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-size:22px;margin:0 0 8px;color:#1B2A3E">Your weekly digest</h1>
        <p style="color:#5a4a3a;margin:0 0 24px">Hi ${org.organizerName}, here's what happened this week.</p>
        <table style="width:100%;border-collapse:collapse">
          ${eventHtmlRows}
        </table>
        <div style="margin-top:28px">
          <a href="https://thelitlyapp.com/dashboard" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View dashboard</a>
        </div>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">Weekly digest from litly. Only sent when you have new RSVPs.</p>
      `),
    });

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
