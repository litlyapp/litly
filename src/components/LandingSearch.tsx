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

  async function handleNearMe(e: React.MouseEvent) {
    e.preventDefault();
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
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county ||
            "";
          const country = data.address?.country || "";
          const location = city ? `${city}, ${country}` : country;
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSubmit(fakeEvent, location);
        } catch {
          setLocating(false);
        }
      },
      () => setLocating(false)
    );
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex max-w-xl mx-auto gap-2"
    >
      <input
        type="text"
        placeholder="Search for readings, open mics, craft talks…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="flex-1 bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-full px-5 py-3 text-sm focus:outline-none focus:border-orange"
      />
      <button
        type="button"
        onClick={handleNearMe}
        disabled={locating}
        title="Near me"
        className="border border-cream/25 text-cream-muted px-4 py-3 rounded-full hover:border-cream/50 hover:text-cream transition shrink-0 disabled:opacity-60"
      >
        {locating ? (
          <span className="text-xs">…</span>
        ) : (
          <PinIcon />
        )}
      </button>
      <button
        type="submit"
        className="bg-orange text-cream font-semibold px-6 py-3 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
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
