import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { formatEventDate, formatEventTime } from "@/lib/formatDate";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Block RSVPs on cancelled events
  const { data: eventCheck } = await supabase
    .from("events")
    .select("is_cancelled")
    .eq("id", eventId)
    .single();
  if (eventCheck?.is_cancelled) {
    return NextResponse.json({ error: "This event has been cancelled." }, { status: 400 });
  }

  // Insert RSVP
  const { error: rsvpError } = await supabase
    .from("rsvps")
    .insert({ user_id: user.id, event_id: eventId });

  if (rsvpError) return NextResponse.json({ error: rsvpError.message }, { status: 500 });

  // Re-check cancellation after insert to close the race window
  const { data: recheck } = await supabase.from("events").select("is_cancelled").eq("id", eventId).single();
  if (recheck?.is_cancelled) {
    await supabase.from("rsvps").delete().eq("user_id", user.id).eq("event_id", eventId);
    return NextResponse.json({ error: "This event has been cancelled." }, { status: 400 });
  }

  // Fetch event details for the confirmation email
  const { data: event } = await supabase
    .from("events")
    .select("title, date_time, timezone, location_name, city, state, virtual_url, event_type")
    .eq("id", eventId)
    .single();

  if (event && user.email) {
    const date = formatEventDate(event.date_time, event.timezone);
    const time = formatEventTime(event.date_time, event.timezone);
    const location =
      event.event_type === "virtual"
        ? "Virtual event"
        : [event.location_name, event.city, event.state].filter(Boolean).join(", ") || "Location TBD";

    await sendEmail({
      to: user.email,
      subject: `You're going to ${event.title}`,
      text: [
        `You're confirmed for ${event.title}.`,
        ``,
        `Date: ${date}`,
        `Time: ${time}`,
        `Location: ${location}`,
        ``,
        `View event: https://thelitlyapp.com/events/${eventId}`,
        ``,
        `— litly`,
      ].join("\n"),
      html: emailWrapper(`
        <h1 style="font-size:24px;margin:0 0 8px;color:#1B2A3E">You're going to<br/><em>${escapeHtml(event.title)}</em></h1>
        <p style="color:#5a4a3a;margin:0 0 24px">Your RSVP is confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:24px">
          <tr><td style="padding:8px 0;color:#7a6a5a;width:90px">Date</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(date)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Time</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(time)}</td></tr>
          <tr><td style="padding:8px 0;color:#7a6a5a">Location</td><td style="padding:8px 0;color:#1B2A3E">${escapeHtml(location)}</td></tr>
        </table>
        <a href="https://thelitlyapp.com/events/${eventId}" style="background:#E8622A;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600">View event</a>
        <p style="margin-top:32px;font-size:12px;color:#7a6a5a">You received this because you RSVPd on litly.</p>
      `),
    }).catch(console.error); // don't block RSVP if email fails
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId } = await req.json();
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  const { error } = await supabase
    .from("rsvps")
    .delete()
    .eq("user_id", user.id)
    .eq("event_id", eventId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
