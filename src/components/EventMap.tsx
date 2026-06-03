"use client";

import dynamic from "next/dynamic";
import type { Genre } from "@/types/database";

export interface MapEvent {
  id: string;
  title: string;
  genre: Genre;
  date_time: string;
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  organizer: { id: string; name: string } | { id: string; name: string }[] | null;
}

// Leaflet must not SSR — it reads window/document at import time
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full rounded-2xl border border-cream/10 bg-navy-light flex items-center justify-center text-cream-muted text-sm"
      style={{ height: "calc(100vh - 220px)", minHeight: 400 }}
    >
      Loading map…
    </div>
  ),
});

export default function EventMap({ events }: { events: MapEvent[] }) {
  return <LeafletMap events={events} />;
}
