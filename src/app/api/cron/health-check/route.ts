import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, emailWrapper, escapeHtml } from "@/lib/sendEmail";
import { STRIPE_LINKS } from "@/lib/stripeLinks";

export const dynamic = "force-dynamic";

const ALERT_EMAIL = "knuth.cdgo@gmail.com";

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MAILGUN_API_KEY",
  "MAILGUN_WEBHOOK_SIGNING_KEY",
  "ANTHROPIC_API_KEY",
  "CRON_SECRET",
];

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const issues: string[] = [];

  // 1. Required env vars present
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) issues.push(`Missing environment variable: ${key}`);
  }

  // 2. Supabase connectivity
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error: dbError } = await supabase.from("events").select("id", { count: "exact", head: true });
  if (dbError) issues.push(`Supabase query failed: ${dbError.message}`);

  // 3. Mailgun domain reachable with current API key
  if (process.env.MAILGUN_API_KEY) {
    try {
      const credentials = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString("base64");
      const res = await fetch("https://api.mailgun.net/v3/domains/thelitlyapp.com", {
        headers: { Authorization: `Basic ${credentials}` },
      });
      if (!res.ok) issues.push(`Mailgun API check failed: HTTP ${res.status}`);
    } catch (e) {
      issues.push(`Mailgun API check error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. Stripe donation links still resolve
  for (const [label, url] of Object.entries(STRIPE_LINKS)) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      // Stripe payment links redirect (3xx) when active; 404 means dead/removed
      if (res.status >= 400) issues.push(`Stripe link "${label}" returned HTTP ${res.status}: ${url}`);
    } catch (e) {
      issues.push(`Stripe link "${label}" check error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 5. Recurring event series running low (daily-series cron may have stalled)
  const { data: ongoingSeries, error: seriesError } = await supabase
    .from("events")
    .select("id, title, series_end_date")
    .eq("is_ongoing", true)
    .eq("is_cancelled", false)
    .not("recurrence_rule", "is", null);

  if (seriesError) {
    issues.push(`Failed to check recurring series: ${seriesError.message}`);
  } else {
    const now = new Date().toISOString();
    for (const series of ongoingSeries ?? []) {
      // A series past its end date legitimately winds down — not a stall
      if (series.series_end_date && new Date(series.series_end_date + "T23:59:59") < new Date()) continue;
      const { count, error: countError } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("parent_event_id", series.id)
        .eq("is_cancelled", false)
        .gte("date_time", now);

      if (countError) {
        issues.push(`Failed to count occurrences for "${series.title}": ${countError.message}`);
      } else if ((count ?? 0) < 3) {
        issues.push(
          `Recurring series "${series.title}" has only ${count ?? 0} upcoming occurrence(s) — daily-series cron may have stalled`
        );
      }
    }
  }

  // 6. Geocode drift: recently created events whose stored pin is far from
  // where their address actually resolves (full-context query). Limited to a
  // 2-day window and 10 lookups so the daily run stays fast and inside
  // Nominatim's 1 req/sec usage policy.
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPinned } = await supabase
    .from("events")
    .select("id, title, address, city, state, country, lat, lng")
    .eq("is_cancelled", false)
    .gte("created_at", twoDaysAgo)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .not("address", "is", null)
    .limit(10);

  for (const e of recentPinned ?? []) {
    const query = [e.address, e.city, e.state, e.country]
      .map((p: string | null) => (p ?? "").trim())
      .filter(Boolean)
      .join(", ");
    if (!query) continue;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
      );
      const data = await res.json();
      if (data[0]) {
        const milesOff = distanceMiles(e.lat, e.lng, parseFloat(data[0].lat), parseFloat(data[0].lon));
        if (milesOff > 10) {
          issues.push(
            `Event "${e.title}" pin is ~${Math.round(milesOff)} miles from its address ("${query}") — run scripts/regeocode.js`
          );
        }
      }
    } catch {
      // geocode check is best-effort; skip on network errors
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  if (issues.length > 0) {
    await sendEmail({
      to: ALERT_EMAIL,
      subject: `litly health check — ${issues.length} issue${issues.length === 1 ? "" : "s"} found`,
      text: `The litly daily health check found the following issue(s):\n\n${issues.map((i) => `- ${i}`).join("\n")}`,
      html: emailWrapper(`
        <h1 style="font-size:22px;margin:0 0 16px;color:#1B2A3E">Health check found ${issues.length} issue${issues.length === 1 ? "" : "s"}</h1>
        <ul style="color:#5a4a3a;padding-left:20px">
          ${issues.map((i) => `<li style="margin-bottom:8px">${escapeHtml(i)}</li>`).join("")}
        </ul>
      `),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, issues });
}
