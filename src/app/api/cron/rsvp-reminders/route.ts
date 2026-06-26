import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBatchEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";
import { getEmailsByUserIds } from "@/lib/userEmails";

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

  // Target events starting between 47h and 49h from now (2-day window, run daily)
  const now = new Date();
  const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 49 * 60 * 60 * 1000);

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, date_time, timezone, location_name, city, state, event_type")
    .eq("is_published", true)
    .eq("is_cancelled", false)
    .gte("date_time", windowStart.toISOString())
    .lte("date_time", windowEnd.toISOString());

  if (error) {
    console.error("[rsvp-reminders] query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;

  for (const event of events) {
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("user_id")
      .eq("event_id", event.id);

    if (!rsvps || rsvps.length === 0) continue;

    const emailMap = await getEmailsByUserIds(supabase, rsvps.map((r) => r.user_id));
    const recipients = [...new Set(emailMap.values())].map((email) => ({ email }));
    if (recipients.length === 0) continue;

    const date = formatEventDate(event.date_time, event.timezone);
    const time = formatEventTime(event.date_time, event.timezone);
    const location =
      event.event_type === "virtual"
        ? "Virtual event"
        : [event.location_name, event.city, event.state].filter(Boolean).join(", ") || "Location TBD";

    await sendBatchEmail({
      recipients,
      subject: `You're going to ${event.title}`,
      text: [
        `Just a reminder — ${event.title} is in 2 days.`,
        ``,
        `Date: ${date}`,
        `Time: ${time}`,
        `Location: ${location}`,
        ``,
        `View event: https://thelitlyapp.com/events/${event.id}`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:24px;margin:0 0 8px;color:#1B2A3E">You're going to<br/><em>${escapeHtml(event.title)}</em></h1>
        <p style="color:#5a4a3a;margin:0 0 24px">Just a reminder — this event is in 2 days.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#7a6a5a;width:90px">Date</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(date)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(time)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(location)}</td></tr>
        </table>
        <a href="https://thelitlyapp.com/events/${event.id}" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View event</a>
        <p style="margin-top:24px;font-size:12px;color:#7a6a5a;border-top:1px solid #d4c9b5;padding-top:16px">If this is a ticketed event, your litly RSVP does not guarantee a ticket. Please confirm ticketing directly with the organizer before attending.</p>
        <p style="margin-top:8px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
      `),
    }).catch((err) => console.error(`[rsvp-reminders] batch failed for event ${event.id}:`, err));

    sent += recipients.length;
  }

  return NextResponse.json({ ok: true, sent });
}
