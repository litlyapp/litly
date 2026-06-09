"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useRef, useEffect } from "react";
import { GENRES } from "@/lib/genres";

interface Organizer {
  id: string;
  name: string;
  avatar_url?: string | null;
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
  const activeOrganizer = searchParams.get("organizer") ?? "";
  const activeQ = searchParams.get("q") ?? "";
  const activeLocation = searchParams.get("location") ?? "";
  const activeFrom = searchParams.get("from") ?? "";
  const activeTo = searchParams.get("to") ?? "";
  const [locating, setLocating] = useState(false);

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

  async function handleNearMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "";
          const country = data.address?.country || "";
          setParam("location", city ? `${city}, ${country}` : country);
        } catch { /* ignore */ }
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  const hasFilters =
    activeQ ||
    activeLocation ||
    activeGenres.length > 0 ||
    activeType !== "all" ||
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

      {/* Location */}
      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
          Location
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="City or country…"
            defaultValue={activeLocation}
            onChange={(e) => setParam("location", e.target.value)}
            className="flex-1 bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
          <button
            type="button"
            onClick={handleNearMe}
            disabled={locating}
            title="Use my location"
            className="border border-cream/20 text-cream-muted px-2.5 py-2 rounded-xl hover:border-orange hover:text-orange transition disabled:opacity-60 shrink-0"
          >
            <PinIcon />
          </button>
        </div>
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
            className="w-full bg-navy border border-cream/30 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange transition-colors [color-scheme:dark]"
          />
          <input
            type="date"
            value={activeTo}
            onChange={(e) => setParam("to", e.target.value)}
            className="w-full bg-navy border border-cream/30 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange transition-colors [color-scheme:dark]"
          />
        </div>
      </div>

      {/* Organizer typeahead */}
      <OrganizerSearch
        organizers={organizers}
        activeId={activeOrganizer}
        onSelect={(id) => setParam("organizer", id)}
      />

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

function PinIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z" />
      <circle cx="12" cy="8.5" r="2.5" />
    </svg>
  );
}

function OrganizerSearch({
  organizers,
  activeId,
  onSelect,
}: {
  organizers: Organizer[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activeName = organizers.find((o) => o.id === activeId)?.name ?? "";
  const [query, setQuery] = useState(activeName);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync if external clear happens
  useEffect(() => {
    setQuery(activeName);
  }, [activeName]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing selected, reset input
        if (!activeId) setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [activeId]);

  const filtered = query.trim()
    ? organizers.filter((o) =>
        o.name.toLowerCase().includes(query.toLowerCase())
      )
    : organizers;

  function select(o: Organizer) {
    setQuery(o.name);
    setOpen(false);
    onSelect(o.id);
  }

  function clear() {
    setQuery("");
    setOpen(false);
    onSelect("");
  }

  return (
    <div ref={ref}>
      <label className="text-cream-muted text-xs uppercase tracking-wider mb-2 block">
        Organizer
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder="Search organizers…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onSelect("");
          }}
          onFocus={() => setOpen(true)}
          className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange pr-7"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-2 text-cream-muted hover:text-cream text-xs"
          >
            ✕
          </button>
        )}

        {open && filtered.length > 0 && (
          <div className="absolute z-50 top-full mt-1 w-full bg-navy-light border border-cream/20 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
            {filtered.slice(0, 20).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => select(o)}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  o.id === activeId
                    ? "text-orange bg-orange/10"
                    : "text-cream-muted hover:text-cream hover:bg-navy"
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
