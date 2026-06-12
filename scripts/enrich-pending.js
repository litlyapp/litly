// One-off backfill: re-enrich pending_imports rows parsed by the pre-fix
// pipeline. Fills ONLY missing fields (never overwrites curated data):
//   1. venue memory — reuse the venue from this source's past approved events
//      (only when the source's recent events consistently share one address)
//   2. source-page fetch — pull venue/time/timezone from the event's own page
//   3. timezone inference — from city/state when the page didn't yield one
// Usage: node --env-file=.env.local scripts/enrich-pending.js [--apply]
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const APPLY = process.argv.includes("--apply");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();
}

async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; litly/1.0; +https://thelitlyapp.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = stripHtml(await res.text());
    return text ? text.slice(0, 10000) : null;
  } catch {
    return null;
  }
}

async function findKnownVenue(sourceName) {
  if (!sourceName?.trim()) return null;
  const { data } = await supabase
    .from("events")
    .select("location_name, address, city, state, country")
    .eq("source_name", sourceName.trim())
    .eq("event_type", "in_person")
    .not("address", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (!data?.length) return null;
  const norm = (s) => (s ?? "").trim().toLowerCase();
  return data.every((v) => norm(v.address) === norm(data[0].address)) ? data[0] : null;
}

async function askHaiku(prompt) {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  const content = message.content[0];
  if (content.type !== "text") return null;
  const m = content.text.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

const missingVenue = (d) =>
  (d.event_type ?? "in_person") === "in_person" && (!d.address || !d.city);
const missingTime = (d) =>
  !d.date_time || d.time_confirmed === false ||
  (d.time_confirmed === undefined && /T00:00/.test(String(d.date_time)));

async function main() {
  const { data: rows, error } = await supabase
    .from("pending_imports")
    .select("id, source_email, parsed_data")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;

  console.log(`${rows.length} pending rows${APPLY ? "" : " (dry run — pass --apply to save)"}\n`);
  let changed = 0;

  for (const row of rows) {
    const d = row.parsed_data;
    if (!d?.title) continue;
    const before = { ...d };
    const filled = [];

    // 1. Venue memory
    if (missingVenue(d)) {
      const venue = await findKnownVenue(d.source_name);
      if (venue) {
        d.location_name = d.location_name ?? venue.location_name;
        d.address = d.address ?? venue.address;
        d.city = d.city ?? venue.city;
        d.state = d.state ?? venue.state;
        d.country = d.country ?? venue.country;
        d.venue_filled_from = "previous events from this source";
        filled.push("venue(memory)");
      }
    }

    // 2. Source-page fetch for whatever is still missing
    const url = d.source_url || d.ticket_url;
    if ((missingVenue(d) || missingTime(d) || !d.timezone) && url && /^https?:\/\//.test(url)) {
      const pageText = await fetchPageText(url);
      if (pageText) {
        try {
          const found = await askHaiku(`Extract ONLY these details for the event "${d.title}" from its webpage. Return ONLY a JSON object:
{
  "location_name": "venue name or null",
  "address": "street address or null",
  "city": "city or null",
  "state": "US state 2-letter code or null",
  "country": "country or null",
  "date_time": "the event's LOCAL wall-clock start time, ISO 8601 WITHOUT timezone offset (e.g. 2026-07-15T19:00:00) or null",
  "time_confirmed": "true only if a start time is explicitly stated",
  "timezone": "IANA timezone implied by the event location (e.g. America/New_York) or null"
}
Do not guess fields that are not stated on the page. Current year is 2026.

Webpage content:
${pageText}`);
          if (found) {
            if (missingVenue(d)) {
              d.location_name = d.location_name ?? found.location_name ?? null;
              d.address = d.address ?? found.address ?? null;
              d.city = d.city ?? found.city ?? null;
              d.state = d.state ?? found.state ?? null;
              d.country = d.country ?? found.country ?? null;
              if (found.address || found.city) filled.push("venue(page)");
            }
            if (missingTime(d) && found.date_time && found.time_confirmed === true) {
              d.date_time = found.date_time;
              d.time_confirmed = true;
              filled.push("time(page)");
            }
            if (!d.timezone && found.timezone) {
              d.timezone = found.timezone;
              filled.push("timezone(page)");
            }
          }
        } catch (e) {
          console.log(`  ! page parse failed for ${d.title}: ${e.message}`);
        }
        await sleep(1500);
      }
    }

    // 3. Timezone from city/state when the page didn't yield one
    if (!d.timezone && (d.city || d.state)) {
      try {
        const found = await askHaiku(
          `What IANA timezone is "${[d.city, d.state, d.country].filter(Boolean).join(", ")}" in? Return ONLY: {"timezone": "America/..."} or {"timezone": null} if ambiguous.`
        );
        if (found?.timezone) {
          d.timezone = found.timezone;
          filled.push("timezone(location)");
        }
      } catch {
        // best-effort
      }
    }

    if (!filled.length) {
      console.log(`= ${String(d.title).slice(0, 55)} — nothing to fill`);
      continue;
    }

    changed++;
    console.log(`+ ${String(d.title).slice(0, 55)} — filled: ${filled.join(", ")}`);
    for (const f of ["location_name", "address", "city", "state", "timezone", "date_time"]) {
      if (before[f] !== d[f]) console.log(`    ${f}: ${JSON.stringify(before[f] ?? null)} → ${JSON.stringify(d[f])}`);
    }

    if (APPLY) {
      const { error: upErr } = await supabase
        .from("pending_imports")
        .update({ parsed_data: d })
        .eq("id", row.id);
      if (upErr) console.log(`  ! update failed: ${upErr.message}`);
    }
  }

  console.log(`\n${changed}/${rows.length} rows enriched${APPLY ? " and saved" : " (dry run — rerun with --apply to save)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
