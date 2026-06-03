"use client";

import { useEffect, useRef } from "react";
import type { MapEvent } from "./EventMap";
import type { Genre } from "@/types/database";

// Genre → pin color (must contrast against the dark OSM tile style we use)
const GENRE_COLORS: Partial<Record<Genre, string>> = {
  poetry: "#E8622A",
  fiction: "#4A90D9",
  nonfiction: "#7B9E6B",
  essay: "#C4A35A",
  hybrid_experimental: "#9B59B6",
  translation: "#E67E22",
  ya: "#E84393",
  craft_talk: "#1ABC9C",
  open_mic: "#E8622A",
  mixed: "#95A5A6",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LeafletMap({ events }: { events: MapEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import so this only runs client-side
    let L: typeof import("leaflet");
    let map: import("leaflet").Map;

    async function init() {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      L = leaflet.default ?? leaflet;

      if (!containerRef.current) return;

      map = L.map(containerRef.current, {
        center: [40.7128, -74.006],
        zoom: 11,
        zoomControl: true,
      });

      // OpenStreetMap tiles — no API key required
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      // Try to center on user's location
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          map.flyTo([pos.coords.latitude, pos.coords.longitude], 12, {
            duration: 1,
          });
        },
        () => {/* permission denied — stay at default center */}
      );

      // Add a marker for each event
      events.forEach((event) => {
        if (!event.lat || !event.lng) return;

        const color = GENRE_COLORS[event.genre] ?? "#E8622A";
        const organizer = Array.isArray(event.organizer)
          ? event.organizer[0]
          : event.organizer;

        // SVG circle pin
        const svgIcon = L.divIcon({
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          popupAnchor: [0, -12],
          html: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7" fill="${color}" stroke="#F2E8D5" stroke-width="2"/>
          </svg>`,
        });

        const popup = L.popup({
          className: "litly-popup",
          closeButton: false,
          maxWidth: 220,
        }).setContent(`
          <div style="font-family:Inter,sans-serif;background:#1B2A3E;border-radius:12px;padding:12px;min-width:180px;">
            <div style="font-weight:600;color:#F2E8D5;margin-bottom:4px;font-size:13px;line-height:1.3;">${event.title}</div>
            <div style="color:#D9D0C0;font-size:11px;margin-bottom:2px;">${formatDate(event.date_time)}</div>
            ${event.location_name ? `<div style="color:#D9D0C0;font-size:11px;margin-bottom:6px;">${event.location_name}</div>` : ""}
            ${organizer ? `<div style="color:#D9D0C0;font-size:11px;margin-bottom:6px;">${organizer.name}</div>` : ""}
            <a href="/events/${event.id}" style="color:#E8622A;font-size:12px;text-decoration:none;font-weight:500;">View event →</a>
          </div>
        `);

        L.marker([event.lat, event.lng], { icon: svgIcon })
          .bindPopup(popup)
          .addTo(map);
      });

      // If we have events, fit the map to show all of them
      const validEvents = events.filter((e) => e.lat && e.lng);
      if (validEvents.length > 0) {
        const bounds = L.latLngBounds(
          validEvents.map((e) => [e.lat!, e.lng!])
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    }

    init();

    return () => {
      map?.remove();
    };
  }, [events]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border border-cream/10"
      style={{ height: "calc(100vh - 220px)", minHeight: 400 }}
    />
  );
}
