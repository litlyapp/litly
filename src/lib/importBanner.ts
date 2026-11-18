import type { SupabaseClient } from "@supabase/supabase-js";
import { safeFetch } from "@/lib/safeUrl";
import { importerRequestHeaders } from "@/lib/webBotAuth";
import { importerAllowedByRobots } from "@/lib/robots";

// Banners for imported events, re-hosted in our own storage (next/image only
// serves Supabase URLs). Tier 1: the event page's own image. Tier 2: the cover
// of the book the event centers on, from Open Library. Otherwise no banner.

const MAX_BYTES = 5 * 1024 * 1024; // event-banners bucket limit
const FETCH_TIMEOUT_MS = 6000;
// Whole banner step; the draft is created without one rather than waiting longer
const TOTAL_BUDGET_MS = 15000;

type ImageKind = "jpeg" | "png" | "webp" | "gif" | "avif";
const MIME: Record<ImageKind, string> = {
  jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif",
};
const EXT: Record<ImageKind, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif", avif: "avif" };

export type BannerSource = "page" | "book_cover";
export interface BookHint { title?: string | null; author?: string | null; isbn?: string | null }

// ---------- Finding candidates on the page ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, keys: string[]): string[] {
  const out: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
    if (content) out.push(decodeEntities(content.trim()));
  }
  return out;
}

function imageFromLd(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFromLd(value[0]);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return (typeof v.url === "string" && v.url) || (typeof v.contentUrl === "string" && v.contentUrl) || null;
  }
  return null;
}

// schema.org Event markup: its image is specific to the event, unlike a
// site-wide og:image that some stores reuse on every page
function jsonLdEventImages(html: string): string[] {
  const out: string[] = [];
  const blocks = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, unknown>;
    const type = n["@type"];
    const types = Array.isArray(type) ? type : [type];
    if (types.some((t) => typeof t === "string" && /Event$/.test(t))) {
      const img = imageFromLd(n.image);
      if (img) out.push(img);
    }
    if (n["@graph"]) visit(n["@graph"]);
  };
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try { visit(JSON.parse(json)); } catch { /* malformed markup — ignore */ }
  }
  return out;
}

/** Image URLs the raw page offers for itself, best first, made absolute. */
export function pageImageCandidates(rawHtml: string, pageUrl: string, modelPick?: string | null): string[] {
  const ordered = [
    ...jsonLdEventImages(rawHtml),
    ...metaContent(rawHtml, ["og:image:secure_url", "og:image", "og:image:url"]),
    ...(modelPick ? [modelPick] : []),
    ...metaContent(rawHtml, ["twitter:image", "twitter:image:src"]),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of ordered) {
    try {
      const abs = new URL(c, pageUrl);
      if (abs.protocol !== "https:" && abs.protocol !== "http:") continue;
      const key = abs.toString();
      if (!seen.has(key)) { seen.add(key); out.push(key); }
    } catch { /* bad URL */ }
  }
  return out;
}

// Comparison key that ignores query strings (CDN resize params) and scheme
function imageKey(u: string): string {
  try { const x = new URL(u); return `${x.hostname.replace(/^www\./, "")}${x.pathname}`; } catch { return u; }
}

// The homepage's share image is the store's generic one (usually a logo or
// storefront) — an event page reusing it has no event-specific image.
async function siteWideImageKeys(pageUrl: string): Promise<Set<string>> {
  const keys = new Set<string>();
  try {
    const home = `${new URL(pageUrl).origin}/`;
    if (home === pageUrl || !(await importerAllowedByRobots(home))) return keys;
    const res = await safeFetch(
      home,
      { headers: { Accept: "text/html" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      importerRequestHeaders,
    );
    if (!res.ok) return keys;
    const html = (await res.text()).slice(0, 300_000);
    for (const c of metaContent(html, ["og:image:secure_url", "og:image", "og:image:url", "twitter:image"])) {
      try { keys.add(imageKey(new URL(c, home).toString())); } catch { /* ignore */ }
    }
  } catch { /* homepage unreachable — no filter */ }
  return keys;
}

// ---------- Downloading and checking ----------

function sniff(b: Uint8Array): ImageKind | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  const ascii = (s: number, e: number) => String.fromCharCode(...b.subarray(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /avi[fs]/.test(ascii(8, 12))) return "avif";
  return null;
}

/** Pixel size from the file header, or null if it can't be read. */
export function imageSize(b: Uint8Array, kind: ImageKind): { w: number; h: number } | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (kind === "png") return { w: dv.getUint32(16), h: dv.getUint32(20) };
    if (kind === "gif") return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    if (kind === "webp") {
      const chunk = String.fromCharCode(...b.subarray(12, 16));
      if (chunk === "VP8 ") return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
      if (chunk === "VP8L") {
        const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
        return { w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
      }
      if (chunk === "VP8X") {
        return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      }
      return null;
    }
    if (kind === "jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker === 0xff) { i++; continue; }
        // Start-of-frame markers (not DHT C4, JPG C8, DAC CC) hold the size
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
        }
        i += 2 + dv.getUint16(i + 2);
      }
      return null;
    }
  } catch { /* truncated header */ }
  return null;
}

interface Downloaded { bytes: Uint8Array; kind: ImageKind; w: number | null; h: number | null }

async function download(url: string, signed: boolean): Promise<Downloaded | null> {
  try {
    const res = await safeFetch(
      url,
      { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      signed ? importerRequestHeaders : undefined,
    );
    if (!res.ok || !res.body) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    // Read with a hard cap — content-length can be missing or wrong
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
    // Trust the bytes, not the Content-Type: the bucket takes rasters only
    const kind = sniff(bytes);
    if (!kind) return null;
    const size = imageSize(bytes, kind);
    return { bytes, kind, w: size?.w ?? null, h: size?.h ?? null };
  } catch {
    return null;
  }
}

const LOGO_LIKE = /(logo|favicon|icon|placeholder|default[-_]?(image|og|share)|blank|spacer|avatar)/i;

// Page images: big enough to fill a 2:1 card, not a sliver, not a logo
function goodPageImage(url: string, img: Downloaded): boolean {
  let file = url;
  try { file = new URL(url).pathname.split("/").pop() ?? url; } catch { /* keep */ }
  if (LOGO_LIKE.test(file)) return false;
  if (img.w === null || img.h === null) return img.bytes.byteLength >= 40_000;
  if (img.w < 400 || img.h < 200) return false;
  const ratio = img.w / img.h;
  return ratio >= 0.5 && ratio <= 4;
}

// ---------- Tier 2: Open Library cover ----------

const norm = (s: string) => s.toLowerCase().replace(/["“”'‘’.,:;!?()&-]/g, " ").replace(/\s+/g, " ").trim();

// Open Library's 1x1 "no cover" placeholder, or a scan too small for a banner
function goodCover(img: Downloaded): boolean {
  if (img.w === null || img.h === null) return img.bytes.byteLength >= 10_000;
  return img.w >= 180 && img.h >= 250;
}

async function bookCover(book: BookHint): Promise<Downloaded | null> {
  const isbn = book.isbn?.replace(/[^0-9Xx]/g, "");
  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    // default=false makes a missing cover a 404 instead of a placeholder image
    const img = await download(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`, true);
    if (img && goodCover(img)) return img;
  }
  const title = book.title?.replace(/^["“]|["”]$/g, "").trim();
  if (!title) return null;
  const params = new URLSearchParams({ title, limit: "5", fields: "title,author_name,cover_i" });
  if (book.author) params.set("author", book.author);
  try {
    const res = await safeFetch(`https://openlibrary.org/search.json?${params}`, {
      headers: { Accept: "application/json", "User-Agent": importerRequestHeaders("https://openlibrary.org")["User-Agent"] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { docs } = (await res.json()) as { docs?: Array<{ title?: string; author_name?: string[]; cover_i?: number }> };
    const want = norm(title);
    const wantAuthor = book.author ? norm(book.author).split(" ").pop() : null;
    // A loose search can return a different book with a similar name — only
    // accept a title match (and the author's surname, when we know it)
    const doc = (docs ?? []).find((d) => {
      if (!d.cover_i || !d.title) return false;
      const got = norm(d.title);
      const titleOk = got === want || got.startsWith(want) || want.startsWith(got);
      const authorOk = !wantAuthor || (d.author_name ?? []).some((a) => norm(a).includes(wantAuthor));
      return titleOk && authorOk;
    });
    if (!doc) return null;
    const img = await download(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`, true);
    return img && goodCover(img) ? img : null;
  } catch {
    return null;
  }
}

// ---------- Main ----------

async function findBanner(opts: {
  rawHtml: string | null;
  pageUrl: string;
  modelPick?: string | null;
  book?: BookHint | null;
}): Promise<{ img: Downloaded; source: BannerSource; from: string } | null> {
  if (opts.rawHtml) {
    const candidates = pageImageCandidates(opts.rawHtml, opts.pageUrl, opts.modelPick).slice(0, 4);
    if (candidates.length) {
      const generic = await siteWideImageKeys(opts.pageUrl);
      for (const c of candidates) {
        if (generic.has(imageKey(c))) continue;
        const img = await download(c, true);
        if (img && goodPageImage(c, img)) return { img, source: "page", from: c };
      }
    }
  }
  if (opts.book?.title || opts.book?.isbn) {
    const img = await bookCover(opts.book);
    if (img) return { img, source: "book_cover", from: "openlibrary" };
  }
  return null;
}

/**
 * Find a banner for an imported event and upload it to the importing user's
 * event-banners folder. Never throws; returns null when nothing usable turns
 * up in time, and the draft is created without a banner.
 */
export async function importBanner(
  supabase: SupabaseClient,
  userId: string,
  opts: { rawHtml: string | null; pageUrl: string; modelPick?: string | null; book?: BookHint | null },
): Promise<{ url: string; source: BannerSource } | null> {
  try {
    const found = await Promise.race([
      findBanner(opts),
      new Promise<null>((r) => setTimeout(() => r(null), TOTAL_BUDGET_MS)),
    ]);
    if (!found) return null;
    const { img, source, from } = found;
    const path = `${userId}/import-${Date.now()}-${Math.random().toString(36).slice(2)}.${EXT[img.kind]}`;
    const { data, error } = await supabase.storage
      .from("event-banners")
      .upload(path, img.bytes, { contentType: MIME[img.kind], upsert: false });
    if (error) {
      console.error("[importBanner] upload failed:", error);
      return null;
    }
    console.log(`[importBanner] ${source} banner from ${from} (${img.w}x${img.h})`);
    return { url: supabase.storage.from("event-banners").getPublicUrl(data.path).data.publicUrl, source };
  } catch (err) {
    console.error("[importBanner] failed:", err);
    return null;
  }
}
