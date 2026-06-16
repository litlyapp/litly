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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch event first, then verify user is a member of the owning org
  const { data: event } = await supabase
    .from("events")
    .select("id, title, date_time, timezone, location_name, city, state, event_type, organizer_id")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", event.organizer_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (membership.role !== "admin") {
    return NextResponse.json({ error: "Only org admins can cancel events." }, { status: 403 });
  }

  // Mark cancelled
  const { error: updateError } = await supabase
    .from("events")
    .update({ is_cancelled: true })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Use service role to fetch RSVPd patron emails
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rsvps } = await serviceClient
    .from("rsvps")
    .select("user_id")
    .eq("event_id", id);

  let notified = 0;
  if (rsvps && rsvps.length > 0) {
    const date = formatEventDate(event.date_time, event.timezone);
    const time = formatEventTime(event.date_time, event.timezone);
    const location =
      event.event_type === "virtual"
        ? "Virtual event"
        : [event.location_name, event.city, event.state].filter(Boolean).join(", ") || "Location TBD";

    const emailMap = await getEmailsByUserIds(serviceClient, rsvps.map((r) => r.user_id));
    const recipients = [...new Set(emailMap.values())].map((email) => ({ email }));
    notified = recipients.length;

    await sendBatchEmail({
      recipients,
      subject: `Cancelled: ${event.title}`,
      text: [
        `We're sorry — ${event.title} has been cancelled.`,
        ``,
        `Original date: ${date} at ${time}`,
        `Location: ${location}`,
        ``,
        `Browse other upcoming events: https://thelitlyapp.com/events`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-family:Georgia,'Times New Roman',Times,serif;font-size:22px;margin:0 0 8px;color:#1B2A3E">Event cancelled</h1>
        <p style="color:#5a4a3a;margin:0 0 20px">We're sorry — <strong>${escapeHtml(event.title)}</strong> has been cancelled.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#7a6a5a;width:110px">Original date</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(date)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(time)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(location)}</td></tr>
        </table>
        <a href="https://thelitlyapp.com/events" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">Browse events</a>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
      `),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, notified });
}
