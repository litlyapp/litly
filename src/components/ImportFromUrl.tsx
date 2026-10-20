"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// When a site blocks our server (e.g. Cloudflare bot challenges on IndieCommerce
// bookstores), offer to import from page text the user copies themselves.
// Set to false to hide the paste step; the route still accepts pageText.
const SHOW_PASTE_FALLBACK = true;

export default function ImportFromUrl({ organizerId }: { organizerId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");

  async function runImport(body: { url: string; organizerId: string; pageText?: string }) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/events/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (SHOW_PASTE_FALLBACK && data.blocked && !body.pageText) {
          setBlockedUrl(body.url);
          setLoading(false);
          return;
        }
        throw new Error(data.error ?? "Import failed");
      }
      router.push(`/events/${data.id}/edit${data.approximatePin ? "?pin=approximate" : ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function handleImport() {
    if (!url.trim()) return;
    setBlockedUrl(null);
    setPageText("");
    runImport({ url: url.trim(), organizerId });
  }

  function handlePastedImport() {
    if (!blockedUrl || !pageText.trim()) return;
    runImport({ url: blockedUrl, organizerId, pageText: pageText.trim() });
  }

  const showPasteStep = blockedUrl !== null && blockedUrl === url.trim();

  return (
    <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 mb-8">
      <p className="text-cream text-sm font-medium mb-1">Import from a URL</p>
      <p className="text-cream-muted text-xs mb-4">
        Paste a link to your event page — your website, Eventbrite listing, venue page, etc. —
        and we&apos;ll pre-fill the details for you to review before publishing.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          placeholder="https://..."
          className="flex-1 bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-xl bg-orange text-cream text-sm font-medium disabled:opacity-40 whitespace-nowrap"
        >
          {loading && !showPasteStep ? "Importing…" : "Import"}
        </button>
      </div>
      {showPasteStep && (
        <div className="mt-4 border-t border-cream/10 pt-4">
          <p className="text-cream text-sm font-medium mb-1">This site won&apos;t let us read it automatically</p>
          <p className="text-cream-muted text-xs mb-3">
            Copy the event&apos;s details and paste them here instead — the title, date, time,
            location and description are all we need, so you don&apos;t have to copy the whole page.
            On a phone, press and hold the text, tap <span className="text-cream">Select All</span>,
            then <span className="text-cream">Copy</span>.{" "}
            <a
              href={blockedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange hover:underline whitespace-nowrap"
            >
              Open event page ↗
            </a>
          </p>
          <textarea
            value={pageText}
            onChange={(e) => setPageText(e.target.value)}
            placeholder="Paste the event details here…"
            rows={5}
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            disabled={loading}
          />
          <button
            type="button"
            onClick={handlePastedImport}
            disabled={loading || !pageText.trim()}
            className="mt-2 px-4 py-2 rounded-xl bg-orange text-cream text-sm font-medium disabled:opacity-40 whitespace-nowrap"
          >
            {loading ? "Importing…" : "Import pasted details"}
          </button>
        </div>
      )}
      {error && <p className="text-orange text-xs mt-2">{error}</p>}
      {loading && (
        <p className="text-cream-muted text-xs mt-2">
          Reading page and extracting event details — this takes a few seconds…
        </p>
      )}
    </div>
  );
}
