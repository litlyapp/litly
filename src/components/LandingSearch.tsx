"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingSearch() {
  const [q, setQ] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/events${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
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
        type="submit"
        className="bg-orange text-cream font-semibold px-6 py-3 rounded-full hover:bg-orange/90 transition text-sm shrink-0"
      >
        Search
      </button>
    </form>
  );
}
