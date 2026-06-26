import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`rsvp:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

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

  // Reminder email is sent 2 days before the event via the rsvp-reminders cron job, not here.
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`rsvp:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

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
