import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Public health endpoint for external uptime monitors.
 * Returns 200 when upcoming published events exist, 503 when the count hits zero.
 * Uses the anon key so RLS breakage is caught the same way a real user would see it.
 *
 * Configure an external monitor (UptimeRobot, Better Uptime, etc.) to GET this
 * URL every 5 minutes and alert on any non-200 response.
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const now = new Date().toISOString();

  const { count, error } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("is_cancelled", false)
    .neq("is_published", false)
    .gte("date_time", now);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, upcoming_events: null },
      { status: 503 }
    );
  }

  const upcomingEvents = count ?? 0;
  const ok = upcomingEvents > 0;

  return NextResponse.json(
    { ok, upcoming_events: upcomingEvents },
    { status: ok ? 200 : 503 }
  );
}
