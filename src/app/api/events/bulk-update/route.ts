import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Genre } from "@/types/database";

type BulkField = "banner_url" | "genre" | "ticket_url" | "virtual_url";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, field, value, orgId }: {
    ids: string[];
    field: BulkField;
    value: string | Genre[];
    orgId: string;
  } = await req.json();

  if (!ids?.length || !field || value === undefined || !orgId) {
    return NextResponse.json({ error: "ids, field, value, orgId required" }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (field === "ticket_url" || field === "virtual_url") {
    // For the link field, apply to the correct column based on each event's type
    const { data: events } = await supabase
      .from("events")
      .select("id, event_type")
      .in("id", ids)
      .eq("organizer_id", orgId);

    if (!events?.length) return NextResponse.json({ ok: true, updated: 0 });

    const inPersonIds = events.filter((e) => e.event_type === "in_person").map((e) => e.id);
    const virtualIds = events.filter((e) => e.event_type !== "in_person").map((e) => e.id);

    await Promise.all([
      inPersonIds.length
        ? supabase.from("events").update({ ticket_url: value as string }).in("id", inPersonIds).eq("organizer_id", orgId)
        : Promise.resolve(),
      virtualIds.length
        ? supabase.from("events").update({ virtual_url: value as string }).in("id", virtualIds).eq("organizer_id", orgId)
        : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true, updated: events.length });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let updatePayload: Record<string, unknown>;
  if (field === "banner_url") updatePayload = { banner_url: value as string };
  else if (field === "genre") updatePayload = { genre: value as Genre[] };
  else return NextResponse.json({ error: "Unknown field" }, { status: 400 });

  const { error } = await db.from("events").update(updatePayload).in("id", ids).eq("organizer_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: ids.length });
}
