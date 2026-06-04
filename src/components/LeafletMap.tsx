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

      // Group events by location
      const locationMap = new Map<string, typeof events>();
      events.forEach((event) => {
        if (!event.lat || !event.lng) return;
        const key = `${event.lat},${event.lng}`;
        if (!locationMap.has(key)) locationMap.set(key, []);
        locationMap.get(key)!.push(event);
      });

      // Add one marker per unique location
      locationMap.forEach((locationEvents, key) => {
        const [lat, lng] = key.split(",").map(Number);
        const primaryGenre = Array.isArray(locationEvents[0].genre)
          ? locationEvents[0].genre[0]
          : locationEvents[0].genre;
        const color = GENRE_COLORS[primaryGenre] ?? "#E8622A";
        const count = locationEvents.length;

        // SVG circle pin — show count badge if multiple events
        const svgIcon = L.divIcon({
          className: "",
          iconSize: count > 1 ? [26, 26] : [18, 18],
          iconAnchor: count > 1 ? [13, 13] : [9, 9],
          popupAnchor: [0, -14],
          html: count > 1
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
                <circle cx="13" cy="13" r="11" fill="${color}" stroke="#F2E8D5" stroke-width="2"/>
                <text x="13" y="17" text-anchor="middle" font-size="10" font-weight="bold" fill="#F2E8D5" font-family="Inter,sans-serif">${count}</text>
              </svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
                <circle cx="9" cy="9" r="7" fill="${color}" stroke="#F2E8D5" stroke-width="2"/>
              </svg>`,
        });

        const popupContent = `
          <div style="font-family:Inter,sans-serif;background:#1B2A3E;border-radius:12px;padding:12px;min-width:200px;max-width:260px;">
            ${locationEvents.map((event, i) => {
              const organizer = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
              return `
                ${i > 0 ? `<div style="border-top:1px solid rgba(242,232,213,0.1);margin:8px 0;"></div>` : ""}
                <div style="font-weight:600;color:#F2E8D5;margin-bottom:3px;font-size:13px;line-height:1.3;">${event.title}</div>
                <div style="color:#D9D0C0;font-size:11px;margin-bottom:2px;">${formatDate(event.date_time)}</div>
                ${organizer ? `<div style="color:#D9D0C0;font-size:11px;margin-bottom:4px;">${organizer.name}</div>` : ""}
                <a href="/events/${event.id}" style="color:#E8622A;font-size:12px;text-decoration:none;font-weight:500;">View event →</a>
              `;
            }).join("")}
          </div>
        `;

        const popup = L.popup({
          className: "litly-popup",
          closeButton: false,
          maxWidth: 280,
        }).setContent(popupContent);

        L.marker([lat, lng], { icon: svgIcon })
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
