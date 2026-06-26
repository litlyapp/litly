import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rateLimit";
import { wallClockToUtc } from "@/lib/importParsing";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@thelitlyapp.com";

// Best-effort server-side geocode so imported events get a map pin
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // geocoding is best-effort
  }
  return null;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`admin:${ip}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { event, password, queueId, organizerId } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Attribute the event to an explicit target org when given; otherwise fall
  // back to the admin's own organizer profile
  let profileId: string | null = null;
  if (organizerId) {
    const { data: target } = await supabase
      .from("organizer_profiles")
      .select("id")
      .eq("id", organizerId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Target organizer not found." }, { status: 400 });
    }
    profileId = target.id;
  } else {
    const { data: profiles } = await supabase
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .order("id", { ascending: true })
      .limit(1);
    profileId = profiles?.[0]?.id ?? null;
  }

  if (!profileId) {
    return NextResponse.json(
      { error: "No organizer profile found. Make sure you are logged in as an organizer." },
      { status: 400 }
    );
  }

  // Geocode in-person events so they appear on the map
  let coords: { lat: number; lng: number } | null = null;
  if ((event.event_type ?? "in_person") === "in_person") {
    const query = [event.address, event.location_name, event.city, event.state, event.zip, event.country]
      .filter(Boolean)
      .join(", ");
    if (query) coords = await geocode(query);
  }

  const { error } = await supabase.from("events").insert({
    organizer_id: profileId,
    title: event.title,
    description: event.description ?? null,
    genre: event.genre,
    event_type: event.event_type ?? "in_person",
    // Parsed times are local wall-clock; convert to true UTC instants when a
    // timezone is known so calendar exports and digests are correct. Without
    // one, naive values still display right via formatDate's legacy fallback.
    date_time: wallClockToUtc(event.date_time, event.timezone) ?? event.date_time,
    timezone: event.timezone ?? null,
    end_time: wallClockToUtc(event.end_time, event.timezone),
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    city: event.city ?? null,
    state: event.state ?? null,
    zip_code: event.zip ?? null,
    country: event.country ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    virtual_url: event.virtual_url ?? null,
    open_mic: event.open_mic ?? false,
    featured_readers: (() => {
      const readers = (event.featured_readers ?? []).filter(
        (r: { name?: string }) => r?.name?.trim()
      );
      return readers.length ? readers : null;
    })(),
    ticket_type: event.ticket_type ?? (event.ticket_url ? "paid" : null),
    ticket_url: event.ticket_url ?? null,
    rsvp_enabled: false,
    is_imported: true,
    source_url: event.source_url ?? null,
    source_name: event.source_name ?? null,
    banner_url: event.banner_url ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark the queue item approved in the same request so a failure between
  // "import" and "approve" can't leave a pending item that re-imports as a
  // duplicate on retry
  if (queueId) {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error: approveError } = await serviceClient
      .from("pending_imports")
      .update({ status: "approved" })
      .eq("id", queueId);
    if (approveError) {
      console.error("[import-event] imported but failed to mark approved:", approveError);
    }
  }

  return NextResponse.json({ success: true });
}
