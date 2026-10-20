// Maintenance: re-geocode events using full address context and fix pins
// that are far from where the address actually resolves. The daily
// health-check cron points here when it detects geocode drift.
// With --missing, instead fills in coordinates for upcoming in-person events
// that have none (the health check's "no map coordinates" alert).
// Usage: node --env-file=.env.local scripts/regeocode.js [--missing] [--apply]
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const MISSING = process.argv.includes("--missing");
const THRESHOLD_MILES = 10;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { "Accept-Language": "en", "User-Agent": "litly-importer/1.0 (+https://thelitlyapp.com/importer)" } }
  );
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
}

// Same query shape as src/lib/geocode.ts: Nominatim returns nothing when the
// venue name or a suite number is mixed into the street query.
function streetForGeocode(address) {
  return address
    .replace(/[,\s]+(suite|ste|apt|apartment|unit|bldg|building|fl|floor|rm|room|#)\.?\s*[\w-]+\s*$/i, "")
    .replace(/[,\s]+\d+(st|nd|rd|th)\s+(fl|floor)\.?\s*$/i, "")
    .replace(/\bMLK\b/gi, "Martin Luther King")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fillMissing() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, address, location_name, city, state, zip_code, country")
    .eq("is_cancelled", false)
    .eq("event_type", "in_person")
    .gte("date_time", new Date().toISOString())
    .is("lat", null)
    .or("address.not.is.null,city.not.is.null");
  if (error) throw error;

  console.log(`${events.length} upcoming in-person event(s) without coordinates…\n`);
  const join = (...parts) => parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
  for (const e of events) {
    const queries = [
      e.address && join(streetForGeocode(e.address), e.city, e.state, e.zip_code, e.country),
      e.location_name && e.city && join(e.location_name, e.city, e.state),
      e.zip_code && join(e.city, e.zip_code, e.country),
      e.city && join(e.city, e.state, e.country),
    ].filter(Boolean);
    let resolved = null;
    let used = null;
    for (const q of [...new Set(queries)]) {
      try {
        resolved = await geocode(q);
      } catch (err) {
        console.log(`! ${e.title}: geocode failed (${err.message})`);
      }
      await sleep(1100);
      if (resolved) { used = q; break; }
    }
    if (!resolved) {
      console.log(`? ${e.title}: no result`);
      continue;
    }
    console.log(`✓ ${e.title}\n    "${used}" → (${resolved.lat}, ${resolved.lng})`);
    if (APPLY) {
      const { error: updErr } = await supabase.from("events").update(resolved).eq("id", e.id);
      if (updErr) console.log(`! update failed for ${e.title}: ${updErr.message}`);
    }
  }
  if (!APPLY && events.length) console.log("\nRe-run with --apply to save these.");
}

async function main() {
  if (MISSING) return fillMissing();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, address, location_name, city, state, country, lat, lng")
    .eq("is_cancelled", false)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .not("address", "is", null);
  if (error) throw error;

  console.log(`Checking ${events.length} events…\n`);
  const mismatches = [];

  for (const e of events) {
    const query = [e.address, e.city, e.state, e.country]
      .map((p) => (p ?? "").trim())
      .filter(Boolean)
      .join(", ");
    if (!query) continue;

    let resolved = null;
    try {
      resolved = await geocode(query);
    } catch (err) {
      console.log(`! ${e.title}: geocode failed (${err.message})`);
    }
    await sleep(1100); // Nominatim usage policy: max 1 req/sec

    if (!resolved) {
      console.log(`? ${e.title}: no geocode result for "${query}"`);
      continue;
    }

    const miles = distanceMiles(e.lat, e.lng, resolved.lat, resolved.lng);
    if (miles > THRESHOLD_MILES) {
      mismatches.push({ ...e, resolved, miles });
      console.log(
        `✗ ${e.title}\n    "${query}"\n    stored (${e.lat}, ${e.lng}) → resolved (${resolved.lat}, ${resolved.lng}) — ${miles.toFixed(0)} mi off`
      );
    } else {
      console.log(`✓ ${e.title} (${miles.toFixed(1)} mi)`);
    }
  }

  console.log(`\n${mismatches.length} mismatch(es) beyond ${THRESHOLD_MILES} miles.`);

  if (!APPLY) {
    if (mismatches.length) console.log("Re-run with --apply to update these rows.");
    return;
  }

  for (const m of mismatches) {
    const { error: updErr } = await supabase
      .from("events")
      .update({ lat: m.resolved.lat, lng: m.resolved.lng })
      .eq("id", m.id);
    console.log(updErr ? `! update failed for ${m.title}: ${updErr.message}` : `→ updated ${m.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
