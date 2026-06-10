"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingSearch() {
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent, location?: string) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (location) params.set("location", location);
    router.push(`/events${params.toString() ? `?${params}` : ""}`);
  }

  function handleNearMe(e: React.MouseEvent) {
    e.preventDefault();
    if (!navigator.geolocation) {
      router.push("/events/map");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        router.push(`/events/map?lat=${latitude}&lng=${longitude}`);
      },
      () => {
        setLocating(false);
        router.push("/events/map");
      }
    );
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex w-full max-w-xl mx-auto gap-2 px-4"
    >
      <input
        type="text"
        placeholder="Search readings, open mics…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1 min-w-0 bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-full px-4 py-3 text-sm focus:outline-none focus:border-orange"
      />
      <button
        type="button"
        onClick={handleNearMe}
        disabled={locating}
        title="Map near me"
        className="border border-cream/25 text-cream-muted px-3 py-3 rounded-full hover:border-cream/50 hover:text-cream transition shrink-0 disabled:opacity-60"
      >
        {locating ? (
          <span className="text-xs">…</span>
        ) : (
          <PinIcon />
        )}
      </button>
      <button
        type="submit"
        className="bg-orange text-cream font-semibold px-5 py-3 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
      >
        Search
      </button>
    </form>
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
