"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div>
      <form
        onSubmit={(e) => handleSubmit(e)}
        className="flex w-full max-w-xl mx-auto gap-2 px-4"
      >
        <input
          type="text"
          placeholder="e.g. Haw River in the Round"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-0 bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-full px-4 py-3 text-sm focus:outline-none focus:border-orange"
        />
        <button
          type="submit"
          className="bg-orange text-cream font-semibold px-5 py-3 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap justify-center items-center gap-3 mt-6">
        <Link
          href="/events/map"
          className="inline-flex items-center gap-2 border border-cream/25 text-cream px-5 py-2.5 rounded-full text-sm font-medium hover:border-orange hover:text-orange transition"
        >
          <MapIcon />
          Explore the map
        </Link>
        <button
          type="button"
          onClick={handleNearMe}
          disabled={locating}
          className="inline-flex items-center gap-2 border border-cream/25 text-cream-muted px-5 py-2.5 rounded-full text-sm font-medium hover:border-cream/50 hover:text-cream transition disabled:opacity-60"
        >
          {locating ? (
            <span>Locating…</span>
          ) : (
            <>
              <PinIcon />
              Near me
            </>
          )}
        </button>
      </div>
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

function MapIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}
