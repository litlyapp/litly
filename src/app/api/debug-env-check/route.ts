import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  let queryResult: { count: number | null; error: string | null } = {
    count: null,
    error: null,
  };

  if (url && anonKey) {
    try {
      const supabase = createClient(url, anonKey);
      const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("is_cancelled", false);
      queryResult = { count: count ?? null, error: error?.message ?? null };
    } catch (e) {
      queryResult = { count: null, error: e instanceof Error ? e.message : "unknown" };
    }
  }

  return NextResponse.json({
    urlPresent: !!url,
    urlHost: url ? new URL(url).host : null,
    anonKeyPresent: !!anonKey,
    anonKeyLength: anonKey?.length ?? 0,
    serviceKeyPresent: !!serviceKey,
    queryResult,
  });
}
