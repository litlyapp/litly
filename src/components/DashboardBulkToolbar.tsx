"use client";

import { useState } from "react";
import BannerUpload from "@/components/BannerUpload";
import { GENRES } from "@/lib/genres";
import type { Genre } from "@/types/database";

type Action = "banner" | "genre" | "link" | null;

interface Props {
  selectedIds: string[];
  orgId: string;
  onClear: () => void;
  onDone: () => void;
}

export default function DashboardBulkToolbar({ selectedIds, orgId, onClear, onDone }: Props) {
  const [action, setAction] = useState<Action>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Field states
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [linkUrl, setLinkUrl] = useState("");

  function toggleGenre(g: Genre) {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  function openAction(a: Action) {
    setAction(a);
    setError(null);
    setBannerUrl(null);
    setGenres([]);
    setLinkUrl("");
  }

  async function applyBulk(field: string, value: unknown) {
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/events/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, field, value, orgId }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Something went wrong.");
        return;
      }
      setAction(null);
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      {/* Sticky toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-navy border border-cream/20 rounded-2xl px-5 py-3 shadow-xl">
        <span className="text-cream text-sm font-medium">{selectedIds.length} selected</span>
        <div className="w-px h-4 bg-cream/20" />
        <button onClick={() => openAction("banner")} className="text-cream-muted text-xs hover:text-cream transition px-2 py-1 rounded-lg hover:bg-cream/10">
          Apply banner
        </button>
        <button onClick={() => openAction("genre")} className="text-cream-muted text-xs hover:text-cream transition px-2 py-1 rounded-lg hover:bg-cream/10">
          Apply genre
        </button>
        <button onClick={() => openAction("link")} className="text-cream-muted text-xs hover:text-cream transition px-2 py-1 rounded-lg hover:bg-cream/10">
          Apply link
        </button>
        <div className="w-px h-4 bg-cream/20" />
        <button onClick={onClear} className="text-cream-muted text-xs hover:text-orange transition">
          Clear
        </button>
      </div>

      {/* Modal */}
      {action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-sm px-4">
          <div className="bg-navy-light border border-cream/20 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-cream font-semibold">
                {action === "banner" && "Apply banner to selected events"}
                {action === "genre" && "Apply genre to selected events"}
                {action === "link" && "Apply ticket / join link to selected events"}
              </h3>
              <button onClick={() => setAction(null)} className="text-cream-muted hover:text-cream text-sm transition">✕</button>
            </div>

            {action === "banner" && (
              <div className="space-y-4">
                <p className="text-cream-muted text-xs">This will overwrite existing banners on all selected events.</p>
                <BannerUpload value={bannerUrl} onChange={setBannerUrl} />
                <button
                  disabled={!bannerUrl || applying}
                  onClick={() => applyBulk("banner_url", bannerUrl)}
                  className="w-full bg-orange text-cream font-semibold py-2.5 rounded-full hover:bg-orange/90 transition disabled:opacity-50"
                >
                  {applying ? "Applying…" : `Apply to ${selectedIds.length} event${selectedIds.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {action === "genre" && (
              <div className="space-y-4">
                <p className="text-cream-muted text-xs">Select one or more genres to apply to all selected events.</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGenre(g.value)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        genres.includes(g.value)
                          ? "bg-orange border-orange text-cream"
                          : "border-cream/20 text-cream-muted hover:border-cream/40"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <button
                  disabled={genres.length === 0 || applying}
                  onClick={() => applyBulk("genre", genres)}
                  className="w-full bg-orange text-cream font-semibold py-2.5 rounded-full hover:bg-orange/90 transition disabled:opacity-50"
                >
                  {applying ? "Applying…" : `Apply to ${selectedIds.length} event${selectedIds.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {action === "link" && (
              <div className="space-y-4">
                <p className="text-cream-muted text-xs">
                  Paste a ticket or registration URL. For virtual events this sets the join link; for in-person events it sets the ticket link.
                </p>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://eventbrite.com/… or zoom.us/j/…"
                  className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange"
                />
                <button
                  disabled={!linkUrl.trim() || applying}
                  onClick={() => applyBulk("ticket_url", linkUrl.trim())}
                  className="w-full bg-orange text-cream font-semibold py-2.5 rounded-full hover:bg-orange/90 transition disabled:opacity-50"
                >
                  {applying ? "Applying…" : `Apply to ${selectedIds.length} event${selectedIds.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            )}

            {error && <p className="text-orange text-xs">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
