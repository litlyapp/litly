import { NextResponse } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  let plainResult: { count: number | null; error: string | null } = {
    count: null,
    error: null,
  };
  let ssrResult: { count: number | null; error: string | null; rows: number } = {
    count: null,
    error: null,
    rows: 0,
  };

  if (url && anonKey) {
    try {
      const supabase = createPlainClient(url, anonKey);
      const { count, error } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("is_cancelled", false);
      plainResult = { count: count ?? null, error: error?.message ?? null };
    } catch (e) {
      plainResult = { count: null, error: e instanceof Error ? e.message : "unknown" };
    }

    try {
      // Exact same client + query shape as the homepage uses
      const supabase = await createServerClient();
      const { data, count, error } = await supabase
        .from("events")
        .select("id", { count: "exact" })
        .eq("is_cancelled", false)
        .is("parent_event_id", null)
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true })
        .limit(6);
      ssrResult = {
        count: count ?? null,
        error: error?.message ?? null,
        rows: data?.length ?? 0,
      };
    } catch (e) {
      ssrResult = { count: null, error: e instanceof Error ? e.message : "unknown", rows: 0 };
    }
  }

  return NextResponse.json({
    urlPresent: !!url,
    urlHost: url ? new URL(url).host : null,
    anonKeyPresent: !!anonKey,
    anonKeyLength: anonKey?.length ?? 0,
    serviceKeyPresent: !!serviceKey,
    plainResult,
    ssrResult,
  });
}
