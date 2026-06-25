import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function toIcsDate(iso: string): string {
  // Emit the true UTC instant with a "Z" suffix so calendar apps display
  // the correct time regardless of the viewer's own timezone.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545 §3.1: lines longer than 75 octets must be folded with CRLF + single space
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) {
    chunks.push(line.slice(i, i + 74));
  }
  return chunks.join("\r\n ");
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
  const dtEnd = event.end_time
    ? toIcsDate(event.end_time)
    : toIcsDate(new Date(new Date(event.date_time).getTime() + 2 * 60 * 60 * 1000).toISOString());

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
  ].filter((l): l is string => l !== null).map(foldLine).join("\r\n");

  return new NextResponse(lines, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
