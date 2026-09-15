import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { isSafeUrl } from "@/lib/safeUrl";
import { CURATED_ORG_ID } from "@/lib/curatedOrg";
import { stripRichText } from "@/lib/richText";

const anthropic = new Anthropic();

// Orgs can always add events manually for free — this cap only limits the
// URL-import convenience feature. litly's own curated-listings org is exempt.
const MONTHLY_IMPORT_LIMIT = 50;

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { "Accept-Language": "en", "User-Agent": "litly/1.0 (thelitlyapp.com)" } }
    );
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    // best-effort
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { url, organizerId } = await request.json();
  if (!url || !organizerId) {
    return NextResponse.json({ error: "Missing url or organizerId" }, { status: 400 });
  }

  // Verify user is a member of the org and fetch org website for source-domain check
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", organizerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // Enforce the monthly URL-import cap before doing any expensive work —
  // manual entry stays unlimited, this only gates the AI-assisted shortcut.
  if (organizerId !== CURATED_ORG_ID) {
    const { data: usageResult, error: usageError } = await supabase.rpc("increment_import_usage", {
      p_org_id: organizerId,
      p_limit: MONTHLY_IMPORT_LIMIT,
    });
    if (usageError) {
      console.error("[import-url] usage check failed:", usageError);
    } else if (usageResult === -1) {
      return NextResponse.json(
        {
          error: `This org has used its ${MONTHLY_IMPORT_LIMIT} free URL imports for this month. You can still add events manually below — higher limits are coming as a paid option.`,
        },
        { status: 429 }
      );
    }
  }

  const { data: orgProfile } = await supabase
    .from("organizer_profiles")
    .select("website")
    .eq("id", organizerId)
    .maybeSingle();

  // If the import URL is from the org's own website, don't credit it as an external source
  const importHost = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const orgHost = (() => { try { return new URL(orgProfile?.website ?? "").hostname.replace(/^www\./, ""); } catch { return ""; } })();
  const isOwnSite = importHost && orgHost && importHost === orgHost;

  // Block SSRF: reject private/internal addresses before fetching
  if (!(await isSafeUrl(url))) {
    return NextResponse.json({ error: "URL is not reachable" }, { status: 422 });
  }

  // Fetch the page — try with a browser-like UA first; some sites block bots
  const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  let html: string;
  try {
    let res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,application/xhtml+xml,*/*" },
      signal: AbortSignal.timeout(10000),
    });
    // Fall back to our own UA if the browser UA still fails
    if (!res.ok && res.status !== 403 && res.status !== 401) {
      throw new Error(`HTTP ${res.status}`);
    }
    if (!res.ok) {
      res = await fetch(url, {
        headers: { "User-Agent": "litly/1.0 (thelitlyapp.com)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }
    html = await res.text();
    // Strip <head>, <script>, <style> blocks to save token budget for actual content
    html = html
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Strip machine-encoded timestamps so Claude reads only the visible display time.
      // Root cause: Claude sees offset-aware datetimes and subtracts the offset (e.g. 19:00-04:00 → 3 PM).
      // Dashed ISO with offset/Z: "2026-06-30T19:00:00-04:00"
      .replace(/\b20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:[+-]\d\d:\d\d|Z)\b/g, "")
      // Compact ISO with offset/Z (The Events Calendar iCal format): "20260630T190000-0400"
      .replace(/\b20\d{6}T\d{6}(?:[+-]\d{4}|Z)\b/g, "")
      // abbr title="..." (The Events Calendar puts compact ISO timestamps here)
      .replace(/(<abbr\b[^>]*?)\stitle="[^"]*"/gi, "$1")
      // datetime="..." attributes on <time> elements
      .replace(/\bdatetime="[^"]*"/gi, "")
      // <meta content="..."> carrying ISO timestamps
      .replace(/(<meta\b[^>]*?)\scontent="20\d\d-\d\d-\d\dT[^"]*"/gi, "$1")
      // data-* attributes whose names suggest timestamps
      .replace(/\sdata-[a-z-]*(?:date|time|start|end|unix|utc|ts)[a-z-]*="[^"]*"/gi, "");
    // Trim to 50k chars — Claude doesn't need the full DOM
    html = html.slice(0, 50000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Some sites (often behind Cloudflare) block our server's datacenter IP with
    // a 403/401 — nothing the organizer can fix, so point them to manual entry
    // rather than showing a raw HTTP error.
    if (/HTTP 40(1|3)/.test(msg)) {
      return NextResponse.json(
        { error: "This site blocked our server from reading the page (403). Please enter the event details manually below." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't reach that page. Double-check the link, or enter the event details manually below." },
      { status: 422 }
    );
  }

  // Extract event data via Claude Haiku
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Extract event information from this HTML and return a JSON object with these exact fields. Use null for any field you cannot determine with confidence.

Fields:
- title: string (event name; if the event centers on a specific book, wrap that book's title in quotation marks the way a reader would expect to see it in print, e.g. Jane Doe Presents "My New Book" — do not quote anything that isn't a book title)
- description: string | null (full event description, plain text — do NOT carry over any bold/italic/markdown/HTML styling from the page, strip it to plain text)
- date: string | null (the event's primary start date in YYYY-MM-DD format, e.g. "2026-08-15" — use the main event date, usually labeled "Event Date" or "Date"; ignore secondary dates such as submission, ticket-sale, RSVP, or announcement deadlines mentioned in the description)
- start_time_display: string | null (time exactly as shown on the page, e.g. "6:00 PM" or "6pm" or "18:00" — copy verbatim, do NOT convert or adjust)
- end_time_display: string | null (end time exactly as shown on the page, same rule)
- timezone: string | null (IANA timezone, e.g. "America/New_York" — infer from the event location or any timezone label shown on the page)
- event_type: "in_person" | "virtual" (default to "in_person" if unclear)
- location_name: string | null (venue name)
- address: string | null (street address only — do NOT include city, state, or zip; those go in their own fields below)
- city: string | null
- state: string | null (2-letter US state code if US)
- zip: string | null (zip / postal code, exactly as shown — copy verbatim, do NOT guess)
- country: string | null
- ticket_url: string | null (URL to buy tickets or RSVP)
- virtual_url: string | null (URL to join virtual event)
- genres: string[] (list of genre/category keywords found anywhere on the page — extract every relevant word or phrase verbatim, e.g. ["Poetry", "Fiction", "Workshop", "Craft Talk", "Open Mic"])
- source_name: string | null (the name of the organization, bookstore, or venue that publishes this page — read it from a logo, header, footer, or copyright line, e.g. "Malaprop's Bookstore/Cafe"; do NOT just return the domain name)
- featured_readers: [{ name: string, url: string | null, bio: string | null }] (ONLY the author(s), poet(s), or reader(s) whose own book or work is being presented at this event. Do NOT include a moderator, interviewer, host, or "in conversation with" partner who is only there to discuss someone else's book — include them only if they are also presenting their own book/work at this same event. For each included person: "url" is a link to their personal site, publisher page, or social media if the page links one, otherwise null. "bio" is their bio/description as plain text if one is shown near their name (strip any bold/italic/markdown/HTML styling from it), otherwise null. Return [] if no qualifying readers are named.)

Return ONLY the JSON object, no explanation.

HTML:
${html}`,
      },
    ],
  });

  let extracted: Record<string, unknown>;
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    extracted = JSON.parse(text);
    console.log("[import-url] extracted:", JSON.stringify({ date: extracted.date, start_time_display: extracted.start_time_display, end_time_display: extracted.end_time_display, timezone: extracted.timezone }));
  } catch {
    return NextResponse.json({ error: "Failed to parse extracted event data" }, { status: 500 });
  }

  // Convert a wall-clock "YYYY-MM-DDTHH:MM:SS" string in `timeZone` to a UTC ISO string.
  // Supabase's timestamptz column treats naive strings as UTC, so we must convert first.
  function wallClockToUtc(naive: string, timeZone: string): string {
    // Parse the naive string as if it were UTC, then determine the actual TZ offset at that instant
    const naiveAsUtc = new Date(`${naive}Z`);
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(naiveAsUtc).reduce<Record<string, string>>((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asUtcMs = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const offsetMs = asUtcMs - naiveAsUtc.getTime();
    return new Date(naiveAsUtc.getTime() - offsetMs).toISOString();
  }

  // Parse display time string → naive "YYYY-MM-DDTHH:MM:SS" wall-clock string
  function buildNaive(date: string | null | undefined, timeDisplay: string | null | undefined): string | null {
    if (!date) return null;
    if (!timeDisplay) return `${date}T00:00:00`;
    // Normalize AP-style "7 p.m." / "7 A.M." (periods) → "7 pm" so the patterns below match
    const t = timeDisplay.trim().toLowerCase().replace(/\./g, "");
    const already = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (already) return `${date}T${already[1].padStart(2,"0")}:${already[2]}:00`;
    const twelve = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
    if (twelve) {
      let h = parseInt(twelve[1], 10);
      const m = parseInt(twelve[2] ?? "0", 10);
      const meridiem = twelve[3];
      if (meridiem === "pm" && h !== 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      return `${date}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
    }
    return null;
  }

  const dateStr = extracted.date as string | null;
  const tz = (extracted.timezone as string | null) || "America/New_York";
  // If we have a date but the start time won't parse (e.g. "noon"), still import
  // at midnight for review rather than dropping the whole event over a time quirk.
  const naiveStart = buildNaive(dateStr, extracted.start_time_display as string | null)
    ?? (dateStr ? `${dateStr}T00:00:00` : null);
  const naiveEnd   = buildNaive(dateStr, extracted.end_time_display as string | null);
  const isoDateTime = naiveStart ? wallClockToUtc(naiveStart, tz) : null;
  const isoEndTime  = naiveEnd   ? wallClockToUtc(naiveEnd,   tz) : null;
  console.log("[import-url] times:", { naiveStart, naiveEnd, isoDateTime, isoEndTime, tz });

  // date_time is NOT NULL on events. If the page exposed no readable date (or
  // buried it among several secondary dates), fail with a clear message instead
  // of letting the constraint surface as a raw Postgres error.
  if (!isoDateTime) {
    return NextResponse.json(
      { error: "Couldn't find the event date on that page. Please enter the event details manually below." },
      { status: 422 }
    );
  }

  // Map extracted genre keywords to litly's fixed genre list
  const GENRE_MAP: Record<string, string> = {
    poetry: "poetry",
    fiction: "fiction",
    nonfiction: "nonfiction", "non-fiction": "nonfiction", "non fiction": "nonfiction",
    translation: "translation",
    ya: "ya", "young adult": "ya",
    "craft talk": "craft_talk", craft: "craft_talk",
    "open mic": "open_mic", "open-mic": "open_mic",
    workshop: "workshop", seminar: "workshop",
    "in conversation": "in_conversation", conversation: "in_conversation", interview: "in_conversation",
    slam: "slam", "poetry slam": "slam",
  };
  const rawGenres = Array.isArray(extracted.genres) ? (extracted.genres as string[]) : [];
  const titleStr = (extracted.title as string) ?? "";
  const mappedGenres = [...new Set(
    [...rawGenres, titleStr].flatMap((g) => {
      const lower = g.toLowerCase();
      return Object.entries(GENRE_MAP)
        .filter(([key]) => lower.includes(key))
        .map(([, val]) => val);
    })
  )];

  // Claude sometimes ignores the "street only" instruction and folds city/state/zip
  // into the address field too, duplicating what's already in their own columns.
  // Strip those back out so the address field holds just the street line.
  function cleanStreetAddress(address: string | null, city: string | null, state: string | null, zip: string | null): string | null {
    if (!address) return address;
    let cleaned = address;
    for (const part of [city, state, zip].filter(Boolean) as string[]) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cleaned = cleaned.replace(new RegExp(`,?\\s*\\b${escaped}\\b`, "gi"), "");
    }
    // Fallback for cases where Claude's city/state/zip fields don't exactly
    // match the text in the address (e.g. spelled-out state name) — strip a
    // trailing "..., City, ST 12345" / "..., ST 12345" / "..., 12345" tail.
    cleaned = cleaned
      .replace(/,\s*[A-Za-z .]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?\s*$/, "")
      .replace(/,\s*[A-Z]{2}\s*\d{5}(-\d{4})?\s*$/, "")
      .replace(/,\s*\d{5}(-\d{4})?\s*$/, "");
    return cleaned.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim() || null;
  }
  const cleanedAddress = cleanStreetAddress(
    extracted.address as string | null,
    extracted.city as string | null,
    extracted.state as string | null,
    extracted.zip as string | null
  );

  // Geocode if in-person
  let coords: { lat: number; lng: number } | null = null;
  if (extracted.event_type !== "virtual") {
    const query = [cleanedAddress, extracted.location_name, extracted.city, extracted.state, extracted.zip, extracted.country]
      .filter(Boolean)
      .join(", ");
    if (query) coords = await geocode(query);
  }

  // Normalize extracted readers into the FeaturedReader shape, dropping any
  // entry Claude returned without a name.
  const rawReaders = Array.isArray(extracted.featured_readers)
    ? (extracted.featured_readers as Array<{ name?: string; url?: string | null; bio?: string | null }>)
    : [];
  // Imports should never carry over bold/italic styling from the source page —
  // that's something people add deliberately when editing, not something
  // scraped content should bring with it. Strip defensively in case Claude
  // ignores the plain-text instruction above.
  const featuredReaders = rawReaders
    .filter((r) => r?.name?.trim())
    .map((r) => ({
      name: r.name!.trim(),
      url: r.url?.trim() || "",
      bio: stripRichText(r.bio?.trim() || ""),
    }));

  // Source attribution always points at the org's homepage, not the specific
  // event page, and uses the org's actual name rather than its bare domain.
  const sourceName = isOwnSite ? null : ((extracted.source_name as string)?.trim() || importHost || null);
  const sourceUrl = isOwnSite ? null : (() => { try { const u = new URL(url); return `${u.protocol}//${u.hostname}`; } catch { return url; } })();

  // When litly's own curated account imports someone else's event, credit
  // the source in the description itself so it survives on the public page.
  let description = extracted.description ? stripRichText(extracted.description as string) : null;
  if (description && sourceName && organizerId === CURATED_ORG_ID) {
    description = `${description}\n\n**(via ${sourceName})**`;
  }

  // Litly's curated account should never duplicate an org that already
  // manages its own account/listings on litly — bail out with a clear error
  // instead of creating a redundant draft.
  if (organizerId === CURATED_ORG_ID) {
    const candidateNames = [sourceName, extracted.location_name as string | null].filter(Boolean) as string[];
    if (candidateNames.length) {
      const { data: otherOrgs } = await supabase
        .from("organizer_profiles")
        .select("id, name")
        .neq("id", CURATED_ORG_ID);
      const workingOrg = (otherOrgs ?? []).find((o) => {
        const a = o.name.toLowerCase().trim();
        return candidateNames.some((c) => {
          const b = c.toLowerCase().trim();
          return a === b || a.includes(b) || b.includes(a);
        });
      });
      if (workingOrg) {
        const dayStart = isoDateTime.slice(0, 10);
        const { data: theirEvents } = await supabase
          .from("events")
          .select("id, title")
          .eq("organizer_id", workingOrg.id)
          .gte("date_time", `${dayStart}T00:00:00`)
          .lt("date_time", `${dayStart}T23:59:59`);
        const normTitle = (t: string) =>
          t.toLowerCase()
            .replace(/["'"'.,!?:;()&]/g, "")
            .replace(/\bwith\b|\bfeaturing\b|\bft\b|\bpresents?\b|\bdiscusses?\b|\blaunches?\b|\bin conversation\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const nd = normTitle(titleStr);
        const dup = (theirEvents ?? []).find((e) => {
          const nt = normTitle(e.title);
          return nd.length && nt.length && (nt.includes(nd.slice(0, 12)) || nd.includes(nt.slice(0, 12)) || nd === nt);
        });
        if (dup) {
          return NextResponse.json(
            {
              error: `${workingOrg.name} already manages their own listings on litly and appears to have already posted this event ("${dup.title}"). Skip importing it here to avoid a duplicate.`,
            },
            { status: 409 }
          );
        }
      }
    }
  }

  // Insert as unpublished draft
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (supabase as any)
    .from("events")
    .insert({
      organizer_id: organizerId,
      title: (extracted.title as string) || "Untitled event",
      description,
      genre: mappedGenres,
      event_type: ((extracted.event_type as string) === "virtual" ? "virtual" : "in_person"),
      date_time: isoDateTime,
      timezone: (extracted.timezone as string) ?? null,
      end_time: isoEndTime,
      location_name: (extracted.location_name as string) ?? null,
      address: cleanedAddress,
      city: (extracted.city as string) ?? null,
      state: (extracted.state as string) ?? null,
      zip_code: (extracted.zip as string) ?? null,
      country: (extracted.country as string) ?? null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      virtual_url: (extracted.virtual_url as string) || url,
      ticket_url: (extracted.ticket_url as string) ?? null,
      source_url: sourceUrl,
      source_name: sourceName,
      featured_readers: featuredReaders.length ? featuredReaders : null,
      is_imported: true,
      // Imported pages' images are external hotlinks that next/image can't
      // serve (only Supabase storage is in remotePatterns) — the organizer
      // uploads a banner manually instead, so don't attempt to set one here.
      banner_url: null,
      open_mic: false,
      rsvp_enabled: true,
      is_published: false,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ id: inserted.id });
}
