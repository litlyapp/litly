import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toIcsDate(iso: string): string {
  // Strip timezone info — treat as local time (same logic as formatDate.ts)
  const local = iso.replace("Z", "").replace(/([+-]\d{2}:\d{2})$/, "").replace("+00", "");
  const d = new Date(local);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, date_time, end_time, location_name, address, city, state, country, event_type, virtual_url")
    .eq("id", id)
    .single();

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dtStart = toIcsDate(event.date_time);
  const dtEnd = event.end_time ? toIcsDate(event.end_time) : dtStart;

  const locationParts = [event.location_name, event.address, event.city, event.state, event.country].filter(Boolean);
  const location = event.event_type === "virtual" && event.virtual_url
    ? event.virtual_url
    : locationParts.join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//litly//litly//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@thelitlyapp.com`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcs(event.description)}` : null,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    `URL:https://thelitlyapp.com/events/${event.id}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
