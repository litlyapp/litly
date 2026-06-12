// One-off audit: flag imported events whose date/time is suspect —
// either an odd-hour start (likely a timezone-offset shift or an
// unstated time defaulted to midnight) or parsed from a bare URL
// (pre-fix parse-event never fetched pages, so details were guessed).
// Read-only: prints a review list for /admin/events; changes nothing.
// Usage: node --env-file=.env.local scripts/audit-import-times.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Real literary events almost never start between midnight and 7am or after
// 11pm local time. Events with a timezone store true UTC instants — check the
// hour in that timezone. Without one, naive imports were stored as-written
// (UTC = wall clock), so the stored hour IS the displayed hour.
function localHourMin(isoUtc, timezone) {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hourCycle: "h23",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(new Date(isoUtc));
      const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
      return [Number(get("hour")), get("minute")];
    } catch {
      // fall through to stored-hour check
    }
  }
  const m = String(isoUtc ?? "").match(/T(\d{2}):(\d{2})/);
  return m ? [Number(m[1]), m[2]] : [12, "00"];
}

async function main() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, date_time, timezone, source_name, source_url, city, state, is_imported, is_cancelled")
    .eq("is_imported", true)
    .eq("is_cancelled", false)
    .gte("date_time", new Date().toISOString())
    .order("date_time", { ascending: true });
  if (error) throw error;

  console.log(`Checking ${events.length} upcoming imported events…\n`);

  const suspects = [];
  for (const e of events) {
    const reasons = [];
    const [h, min] = localHourMin(e.date_time, e.timezone);
    if (h < 7 || h === 23) {
      reasons.push(
        `starts at ${String(h).padStart(2, "0")}:${min} local${e.timezone ? ` (${e.timezone})` : " (no timezone — displays stored hour as-is)"} — likely unstated time or offset shift`
      );
    }
    if (e.source_url && !e.source_name) {
      reasons.push("URL-only import — details may be hallucinated (pre-fix parser never fetched pages)");
    }
    if (reasons.length) suspects.push({ ...e, reasons });
  }

  if (!suspects.length) {
    console.log("No suspect events found.");
    return;
  }

  console.log(`${suspects.length} suspect event(s):\n`);
  for (const s of suspects) {
    console.log(`• ${s.title}`);
    console.log(`  when:   ${s.date_time}`);
    console.log(`  where:  ${[s.city, s.state].filter(Boolean).join(", ") || "—"}`);
    console.log(`  source: ${s.source_name ?? "—"} ${s.source_url ?? ""}`);
    for (const r of s.reasons) console.log(`  ⚠ ${r}`);
    console.log(`  edit:   https://thelitlyapp.com/events/${s.id}/edit`);
    console.log("");
  }
  console.log("Verify each against its source page, then fix via the edit link or /admin/events.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
