import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { event, password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Find or create the "litly imports" organizer profile
  let { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("name", "litly imports")
    .single();

  if (!profile) {
    // Get the first user to attach the profile to (or use a service role in production)
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: newProfile, error: profileError } = await supabase
      .from("organizer_profiles")
      .insert({
        user_id: user.user.id,
        org_type: "organization",
        name: "litly imports",
        bio: "Events imported and curated by the litly team.",
      })
      .select("id")
      .single();

    if (profileError || !newProfile) {
      return NextResponse.json(
        { error: "Failed to create importer profile" },
        { status: 500 }
      );
    }
    profile = newProfile;
  }

  const { error } = await supabase.from("events").insert({
    organizer_id: profile.id,
    title: event.title,
    description: event.description ?? null,
    genre: event.genre,
    event_type: event.event_type,
    date_time: event.date_time,
    end_time: event.end_time ?? null,
    location_name: event.location_name ?? null,
    address: event.address ?? null,
    virtual_url: event.virtual_url ?? null,
    open_mic: event.open_mic ?? false,
    featured_readers: event.featured_readers ?? null,
    rsvp_enabled: false,
    is_imported: true,
    source_url: event.source_url ?? null,
    source_name: event.source_name ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
