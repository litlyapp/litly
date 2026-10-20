// Server-side Nominatim geocoding, shared by the URL importer, the org feed
// syncs, and the health check. (EventForm geocodes in the browser with the
// same query shape.) Nominatim's free-form search is all-or-nothing: one
// token it can't place — a venue name, "Suite 500", "MLK" — and it returns
// an empty list with a 200, so queries are built from clean address parts only.
import { IMPORTER_USER_AGENT } from "@/lib/webBotAuth";

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** Pin is a zip or city centroid, not the venue itself */
  approximate: boolean;
}

export interface GeocodeLocation {
  address?: string | null;
  locationName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim usage policy: at most 1 request per second
const NOMINATIM_INTERVAL_MS = 1100;

// Warm serverless instances reuse this — bulk imports often hit the same venue
// several times in a row. Only definitive answers (a hit or an empty result)
// are cached; HTTP/network errors are not.
type Hit = { lat: number; lng: number; localities: string[] };
const cache = new Map<string, Hit | null>();
const CACHE_MAX = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Nominatim lookup. Logs non-200s and failures instead of swallowing them silently. */
export async function nominatimSearch(
  query: string
): Promise<Hit | null> {
  const key = query.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`,
      {
        headers: { "Accept-Language": "en", "User-Agent": IMPORTER_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      console.error(`[geocode] Nominatim ${res.status} for "${query}": ${body}`);
      return null;
    }
    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const addr = hit?.address ?? {};
    const result = hit
      ? {
          lat: parseFloat(hit.lat),
          lng: parseFloat(hit.lon),
          // City plus the finer/coarser localities Nominatim may file it under
          // (e.g. Brooklyn is a suburb of New York City)
          localities: [addr.city, addr.town, addr.village, addr.municipality, addr.suburb, addr.borough, addr.county]
            .filter(Boolean)
            .map((c: string) => c.toLowerCase()),
        }
      : null;
    if (!result) console.warn(`[geocode] no result for "${query}"`);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch (err) {
    console.error(`[geocode] request failed for "${query}":`, err);
    return null;
  }
}

/** Normalize a street line into a form Nominatim can resolve. */
export function streetForGeocode(address: string): string {
  return address
    // Unit suffixes ("Suite 500", "Ste. 2", "#3", "2nd Floor") — OSM has no units
    .replace(/[,\s]+(suite|ste|apt|apartment|unit|bldg|building|fl|floor|rm|room|#)\.?\s*[\w-]+\s*$/i, "")
    .replace(/[,\s]+\d+(st|nd|rd|th)\s+(fl|floor)\.?\s*$/i, "")
    .replace(/\bMLK\b/gi, "Martin Luther King")
    // "E. Washington St." → "E Washington St"
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Best-effort pin for an in-person event: the street address first, then the
 * venue name in its city (OSM often has the venue as a place), then the zip
 * centroid, then the city. A pin that's
 * a little off beats no pin — events without coordinates never show on the map.
 */
export async function geocodeLocation(loc: GeocodeLocation): Promise<GeocodeResult | null> {
  const clean = (v?: string | null) => (v ?? "").trim();
  const street = loc.address ? streetForGeocode(loc.address) : "";
  const venue = clean(loc.locationName);
  const city = clean(loc.city);
  const state = clean(loc.state);
  const zip = clean(loc.zip);
  const country = clean(loc.country);
  const join = (...parts: string[]) => parts.filter(Boolean).join(", ");

  const candidates: Array<{ query: string; approximate: boolean }> = [];
  if (street) candidates.push({ query: join(street, city, state, zip, country), approximate: false });
  if (venue && city) candidates.push({ query: join(venue, city, state), approximate: false });
  if (zip) candidates.push({ query: join(city, zip, country), approximate: true });
  if (city) candidates.push({ query: join(city, state, country), approximate: true });

  const expectedCity = city.toLowerCase();
  const seen = new Set<string>();
  for (const { query, approximate } of candidates) {
    if (seen.has(query)) continue;
    if (seen.size > 0) await sleep(NOMINATIM_INTERVAL_MS);
    seen.add(query);
    const hit = await nominatimSearch(query);
    if (!hit) continue;
    // Reject a hit in a different city — a wrong pin is worse than a fallback
    if (
      expectedCity &&
      hit.localities.length &&
      !hit.localities.some((c) => c.includes(expectedCity) || expectedCity.includes(c))
    ) {
      console.warn(`[geocode] "${query}" resolved to ${hit.localities[0]}, expected ${city} — skipping`);
      continue;
    }
    return { lat: hit.lat, lng: hit.lng, approximate };
  }
  return null;
}

/**
 * Pin for a single free-text location (an iCal LOCATION, usually
 * "Venue, 123 Main St, City, ST 12345"). Venue-first strings mostly resolve
 * as-is; when the venue isn't in OSM, retry with that leading segment dropped.
 */
export async function geocodeFreeform(text: string): Promise<{ lat: number; lng: number } | null> {
  const full = text.replace(/\s+/g, " ").trim();
  if (!full) return null;
  const hit = await nominatimSearch(full);
  if (hit) return { lat: hit.lat, lng: hit.lng };

  const parts = full.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const rest = parts.slice(1);
  rest[0] = streetForGeocode(rest[0]);
  await sleep(NOMINATIM_INTERVAL_MS);
  const retry = await nominatimSearch(rest.join(", "));
  return retry ? { lat: retry.lat, lng: retry.lng } : null;
}
