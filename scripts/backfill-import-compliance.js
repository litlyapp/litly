// One-off backfill: bring existing unpublished, URL-imported draft events in
// line with the rules added to src/app/api/events/import-url/route.ts —
// homepage-based source attribution, real org names, quoted book titles,
// "(via org)" credit on curated-org descriptions, city/state/zip-free
// addresses, RSVPs enabled by default, and extracted featured readers/bios.
// Usage: node --env-file=.env.local scripts/backfill-import-compliance.js [--apply]
const { createClient } = require("@supabase/supabase-js");
const Anthropic = require("@anthropic-ai/sdk");

const APPLY = process.argv.includes("--apply");
const CURATED_ORG_ID = "f5fe9919-c768-49f0-90f6-d109b6c9e2bf";

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

async function fetchPageText(url, maxChars = 12000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = stripHtml(await res.text());
    return text ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

let claudeDisabled = false;

async function askHaiku(prompt) {
  if (claudeDisabled) return null;
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const content = message.content[0];
    if (content.type !== "text") return null;
    const raw = content.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch (e) {
    if (e?.status === 400 && /credit balance/i.test(e?.error?.error?.message || "")) {
      claudeDisabled = true;
      console.log("\n! Anthropic API credit balance too low — skipping all Claude-dependent fixes (source name, title quoting, featured readers) for the rest of this run.\n");
    }
    return null;
  }
}

// Same stripping logic as import-url/route.ts's cleanStreetAddress
function cleanStreetAddress(address, city, state, zip) {
  if (!address) return address;
  let cleaned = address;
  for (const part of [city, state, zip].filter(Boolean)) {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`,?\\s*\\b${escaped}\\b`, "gi"), "");
  }
  cleaned = cleaned
    .replace(/,\s*[A-Za-z .]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?\s*$/, "")
    .replace(/,\s*[A-Z]{2}\s*\d{5}(-\d{4})?\s*$/, "")
    .replace(/,\s*\d{5}(-\d{4})?\s*$/, "");
  return cleaned.replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim() || null;
}

// A source_name is "raw domain-ish" if it's exactly what a hostname would look
// like (all lowercase, no spaces, contains a dot) — meaning it predates the
// fix that asks Claude for the org's real name instead.
function looksLikeBareDomain(name) {
  if (!name) return false;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(name.trim()) && !/\s/.test(name);
}

async function main() {
  const { data: rows, error } = await supabase
    .from("events")
    .select("id, title, description, event_type, organizer_id, source_url, source_name, virtual_url, address, city, state, zip_code, featured_readers, rsvp_enabled")
    .eq("is_imported", true)
    .eq("is_published", false)
    .order("created_at", { ascending: false });
  if (error) throw error;

  console.log(`${rows.length} unpublished imported draft(s)${APPLY ? "" : " (dry run — pass --apply to save)"}\n`);
  let changed = 0;

  for (const row of rows) {
    const patch = {};
    const notes = [];

    // 1. RSVPs default on
    if (row.rsvp_enabled === false) {
      patch.rsvp_enabled = true;
      notes.push("rsvp_enabled: false → true");
    }

    // 2. Address free of city/state/zip
    const cleanedAddress = cleanStreetAddress(row.address, row.city, row.state, row.zip_code);
    if (cleanedAddress !== row.address) {
      patch.address = cleanedAddress;
      notes.push(`address: ${JSON.stringify(row.address)} → ${JSON.stringify(cleanedAddress)}`);
    }

    // 2b. source_url must be the homepage, never the specific event page
    if (row.source_url) {
      try {
        const u = new URL(row.source_url);
        if (u.pathname && u.pathname !== "/") {
          const homepage = `${u.protocol}//${u.hostname}`;
          patch.source_url = homepage;
          notes.push(`source_url: ${JSON.stringify(row.source_url)} → ${JSON.stringify(homepage)}`);
        }
      } catch {
        // leave malformed source_url alone
      }
    }

    // The original scraped page — only recoverable for in-person imports,
    // where virtual_url falls back to the pasted import URL. Virtual events
    // store the actual join link there instead, so there's nothing to refetch.
    const originalPageUrl = row.event_type === "in_person" && /^https?:\/\//.test(row.virtual_url || "")
      ? row.virtual_url
      : null;

    let pageText = null;
    if (!claudeDisabled && originalPageUrl && (looksLikeBareDomain(row.source_name) || !row.featured_readers?.length)) {
      pageText = await fetchPageText(originalPageUrl);
      await sleep(500);
    }

    // 3. Real org name instead of a bare domain
    let sourceName = row.source_name;
    if (pageText && looksLikeBareDomain(row.source_name)) {
      const found = await askHaiku(`What organization, bookstore, or venue publishes this webpage? Read its logo, header, footer, or copyright line. Return ONLY {"source_name": "..."} or {"source_name": null} if you can't tell.\n\n${pageText}`);
      if (found?.source_name?.trim()) {
        sourceName = found.source_name.trim();
        patch.source_name = sourceName;
        notes.push(`source_name: ${JSON.stringify(row.source_name)} → ${JSON.stringify(sourceName)}`);
      }
    }

    // 4. "(via org)" credit on curated-org descriptions
    if (
      row.organizer_id === CURATED_ORG_ID &&
      row.description &&
      sourceName &&
      !row.description.includes(`(via ${sourceName})`) &&
      !/\(via [^)]+\)\s*$/.test(row.description.trim())
    ) {
      patch.description = `${row.description}\n\n(via ${sourceName})`;
      notes.push(`description: appended "(via ${sourceName})"`);
    }

    // 5. Quoted book titles
    if (row.title && !row.title.includes('"')) {
      const found = await askHaiku(`This is a literary event title: "${row.title}"\nIf it centers on a specific book, rewrite it with that book's title wrapped in quotation marks the way a reader would expect to see it in print (e.g. Jane Doe Presents "My New Book"). If it doesn't reference a specific book title, return it unchanged. Return ONLY {"title": "..."}.`);
      if (found?.title?.trim() && found.title.trim() !== row.title && found.title.includes('"')) {
        patch.title = found.title.trim();
        notes.push(`title: ${JSON.stringify(row.title)} → ${JSON.stringify(patch.title)}`);
      }
    }

    // 6. Featured readers/bios
    if (pageText && !row.featured_readers?.length) {
      const found = await askHaiku(`Extract ONLY the author(s), poet(s), or reader(s) whose own book or work is being presented at this literary event, from its webpage. Do NOT include a moderator, interviewer, host, or "in conversation with" partner who is only there to discuss someone else's book — include them only if they are also presenting their own book/work at this same event. For each qualifying person, return their name, a link to their site/publisher/social media if the page links one (else null), and their bio exactly as written on the page if shown near their name (else null). Return ONLY {"featured_readers": [{"name": "...", "url": "..." | null, "bio": "..." | null}]}. Return {"featured_readers": []} if no qualifying readers are named.\n\n${pageText}`);
      const readers = (found?.featured_readers ?? [])
        .filter((r) => r?.name?.trim())
        .map((r) => ({ name: r.name.trim(), url: r.url?.trim() || "", bio: r.bio?.trim() || "" }));
      if (readers.length) {
        patch.featured_readers = readers;
        notes.push(`featured_readers: added ${readers.length} (${readers.map((r) => r.name).join(", ")})`);
      }
    }

    if (!notes.length) {
      console.log(`= ${String(row.title).slice(0, 60)} — already compliant`);
      continue;
    }

    changed++;
    console.log(`+ ${String(row.title).slice(0, 60)} [${row.id}]`);
    for (const n of notes) console.log(`    ${n}`);

    if (APPLY) {
      const { error: upErr } = await supabase.from("events").update(patch).eq("id", row.id);
      if (upErr) console.log(`  ! update failed: ${upErr.message}`);
    }
  }

  console.log(`\n${changed}/${rows.length} draft(s) updated${APPLY ? "" : " (dry run — rerun with --apply to save)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
