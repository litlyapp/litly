"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

const GENRES = [
  { value: "poetry", label: "Poetry" },
  { value: "fiction", label: "Fiction" },
  { value: "nonfiction", label: "Nonfiction" },
  { value: "essay", label: "Essay" },
  { value: "hybrid_experimental", label: "Hybrid / Experimental" },
  { value: "translation", label: "Translation" },
  { value: "ya", label: "YA" },
  { value: "craft_talk", label: "Craft Talk" },
  { value: "open_mic", label: "Open Mic" },
  { value: "mixed", label: "Mixed" },
] as const;

interface Organizer {
  id: string;
  name: string;
}

export default function EventFilters({
  organizers,
}: {
  organizers: Organizer[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeGenres = searchParams.getAll("genre");
  const activeType = searchParams.get("type") ?? "all";
  const activeOpenMic = searchParams.get("open_mic") === "1";
  const activeOrganizer = searchParams.get("organizer") ?? "";
  const activeQ = searchParams.get("q") ?? "";
  const activeFrom = searchParams.get("from") ?? "";
  const activeTo = searchParams.get("to") ?? "";

  const push = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname]
  );

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    push(params);
  }

  function toggleGenre(genre: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.getAll("genre");
    params.delete("genre");
    if (current.includes(genre)) {
      current.filter((g) => g !== genre).forEach((g) => params.append("genre", g));
    } else {
      [...current, genre].forEach((g) => params.append("genre", g));
    }
    push(params);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasFilters =
    activeQ ||
    activeGenres.length > 0 ||
    activeType !== "all" ||
    activeOpenMic ||
    activeOrganizer ||
    activeFrom ||
    activeTo;

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Search
        </label>
        <input
          type="text"
          placeholder="Event name…"
          defaultValue={activeQ}
          onChange={(e) => setParam("q", e.target.value)}
          className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
      </div>

      {/* Event type */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {(["all", "in_person", "virtual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setParam("type", t === "all" ? "" : t)}
              className={`px-3 py-1 rounded-full text-sm border transition ${
                activeType === t
                  ? "bg-orange border-orange text-cream"
                  : "border-cream-muted/40 text-cream-muted hover:border-cream hover:text-cream"
              }`}
            >
              {t === "all" ? "All" : t === "in_person" ? "In Person" : "Virtual"}
            </button>
          ))}
        </div>
      </div>

      {/* Genre */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Genre
        </label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const active = activeGenres.includes(g.value);
            return (
              <button
                key={g.value}
                onClick={() => toggleGenre(g.value)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  active
                    ? "bg-orange border-orange text-cream"
                    : "border-cream-muted/40 text-cream-muted hover:border-cream hover:text-cream"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Date range
        </label>
        <div className="space-y-2">
          <input
            type="date"
            value={activeFrom}
            onChange={(e) => setParam("from", e.target.value)}
            className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange [color-scheme:dark]"
          />
          <input
            type="date"
            value={activeTo}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Organizer */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Organizer
        </label>
        <select
          value={activeOrganizer}
          onChange={(e) => setParam("organizer", e.target.value)}
          className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        >
          <option value="">All organizers</option>
          {organizers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Open mic toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() =>
              setParam("open_mic", activeOpenMic ? "" : "1")
            }
            className={`w-10 h-6 rounded-full border transition relative ${
              activeOpenMic
                ? "bg-orange border-orange"
                : "bg-navy-light border-cream/30"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
                activeOpenMic ? "left-4" : "left-0.5"
              }`}
            />
          </div>
          <span className="text-cream-muted text-sm">Open mic only</span>
        </label>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-cream-muted hover:text-cream text-sm underline underline-offset-2"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
