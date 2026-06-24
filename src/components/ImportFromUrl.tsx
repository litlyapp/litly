"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportFromUrl({ organizerId }: { organizerId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/events/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), organizerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      router.push(`/events/${data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

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
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
      {error && <p className="text-orange text-xs mt-2">{error}</p>}
      {loading && (
        <p className="text-cream-muted text-xs mt-2">
          Reading page and extracting event details — this takes a few seconds…
        </p>
      )}
    </div>
  );
}
