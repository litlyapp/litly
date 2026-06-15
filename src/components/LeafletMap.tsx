"use client";

import { useEffect, useRef, useState } from "react";
import type { MapEvent } from "./EventMap";
const RADIUS_OPTIONS = [
  { label: "5 mi", miles: 5 },
  { label: "10 mi", miles: 10 },
  { label: "25 mi", miles: 25 },
  { label: "50 mi", miles: 50 },
  { label: "All", miles: null },
];

function formatDate(iso: string, timeZone?: string | null) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LeafletMap({
  events,
  initialUserLoc,
}: {
  events: MapEvent[];
  initialUserLoc?: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const circleRef = useRef<import("leaflet").Circle | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(initialUserLoc ?? null);
  const [radius, setRadius] = useState<number | null>(initialUserLoc ? 25 : null);
  const [mapReady, setMapReady] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const didFitRef = useRef(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);

  // Init map once
  useEffect(() => {
    if (!containerRef.current) return;
    let map: import("leaflet").Map;

    async function init() {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      const L = leaflet.default ?? leaflet;
      LRef.current = L;

      if (!containerRef.current) return;

      map = L.map(containerRef.current, {
        center: initialUserLoc ? [initialUserLoc.lat, initialUserLoc.lng] : [40.7128, -74.006],
        zoom: initialUserLoc ? 11 : 11,
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);

      // If we already have the user's location, center there; otherwise
      // fit to events on load (user can request their location via button)
      if (initialUserLoc) {
        map.setView([initialUserLoc.lat, initialUserLoc.lng], 11);
      } else {
        const valid = events.filter((e) => e.lat && e.lng);
        if (valid.length > 0) {
          const bounds = L.latLngBounds(valid.map((e) => [e.lat!, e.lng!]));
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }
      }

      // Re-cluster markers whenever the zoom level changes
      map.on("zoomend", () => setZoom(map.getZoom()));
      setZoom(map.getZoom());

      // Signal that map is ready so markers can be drawn
      setMapReady(true);
    }

    init();
    return () => { map?.remove(); mapRef.current = null; markerLayerRef.current = null; LRef.current = null; setMapReady(false); };
  }, []);

  // Re-draw markers whenever events, userLoc, or radius changes
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!L || !map || !layer) return;

    // Remove old circle
    circleRef.current?.remove();
    circleRef.current = null;

    // Filter events by radius if set
    let filtered = events;
    if (userLoc && radius !== null) {
      filtered = events.filter((e) => {
        if (!e.lat || !e.lng) return false;
        return distanceMiles(userLoc.lat, userLoc.lng, e.lat, e.lng) <= radius;
      });

      // Draw radius circle
      const circle = L.circle([userLoc.lat, userLoc.lng], {
        radius: radius * 1609.34,
        color: "#E8622A",
        fillColor: "#E8622A",
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);
      circleRef.current = circle;
    }

    // Clear and re-add markers
    layer.clearLayers();

    // Show "no nearby events" message if filtered is empty
    if (filtered.length === 0 && userLoc && radius !== null) {
      const msg = L.popup({ closeButton: true, className: "litly-popup" })
        .setLatLng([userLoc.lat, userLoc.lng])
        .setContent(`
          <div style="font-family:Aileron,system-ui,sans-serif;background:#1B2A3E;border-radius:12px;padding:12px;min-width:180px;text-align:center;">
            <div style="color:#F2E8D5;font-size:13px;font-weight:600;margin-bottom:4px;">No events within ${radius} miles</div>
            <div style="color:#D9D0C0;font-size:11px;">Try a larger radius.</div>
          </div>
        `)
        .openOn(map);
      return;
    }

    // Group by location
    const locationMap = new Map<string, typeof filtered>();
    filtered.forEach((event) => {
      if (!event.lat || !event.lng) return;
      const key = `${event.lat},${event.lng}`;
      if (!locationMap.has(key)) locationMap.set(key, []);
      locationMap.get(key)!.push(event);
    });

    // Cluster locations whose dots would overlap at the current zoom level
    // (within ~44px on screen). Clusters re-split as the user zooms in.
    const currentZoom = map.getZoom();
    const CLUSTER_PX = 44;
    type Cluster = { locations: { lat: number; lng: number; events: typeof filtered }[] };
    const clusters: Cluster[] = [];
    locationMap.forEach((locationEvents, key) => {
      const [lat, lng] = key.split(",").map(Number);
      const pt = map.project([lat, lng], currentZoom);
      const existing = clusters.find((c) =>
        c.locations.some((loc) => {
          const other = map.project([loc.lat, loc.lng], currentZoom);
          return pt.distanceTo(other) < CLUSTER_PX;
        })
      );
      if (existing) {
        existing.locations.push({ lat, lng, events: locationEvents });
      } else {
        clusters.push({ locations: [{ lat, lng, events: locationEvents }] });
      }
    });

    clusters.forEach((cluster) => {
      const locationEvents = cluster.locations.flatMap((loc) => loc.events);
      const count = locationEvents.length;
      const isMultiLocation = cluster.locations.length > 1;
      // Center the marker on the cluster's locations (weighted equally)
      const lat = cluster.locations.reduce((s, l) => s + l.lat, 0) / cluster.locations.length;
      const lng = cluster.locations.reduce((s, l) => s + l.lng, 0) / cluster.locations.length;
      const color = "#E8622A";

      const svgIcon = L.divIcon({
        className: "",
        iconSize: count > 1 ? [26, 26] : [18, 18],
        iconAnchor: count > 1 ? [13, 13] : [9, 9],
        popupAnchor: [0, -14],
        html: count > 1
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
              <circle cx="13" cy="13" r="11" fill="${color}" stroke="#F2E8D5" stroke-width="2"/>
              <text x="13" y="17" text-anchor="middle" font-size="10" font-weight="bold" fill="#F2E8D5" font-family="Aileron,system-ui,sans-serif">${count}</text>
            </svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
              <circle cx="9" cy="9" r="7" fill="${color}" stroke="#F2E8D5" stroke-width="2"/>
            </svg>`,
      });

      const popupContent = `
        <div style="font-family:Aileron,system-ui,sans-serif;background:#1B2A3E;border-radius:12px;padding:12px;min-width:200px;max-width:260px;">
          ${locationEvents.map((event, i) => {
            const organizer = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
            return `
              ${i > 0 ? `<div style="border-top:1px solid rgba(242,232,213,0.1);margin:8px 0;"></div>` : ""}
              <div style="font-weight:600;color:#F2E8D5;margin-bottom:3px;font-size:13px;line-height:1.3;">${escapeHtml(event.title)}</div>
              <div style="color:#D9D0C0;font-size:11px;margin-bottom:2px;">${formatDate(event.date_time, (event as typeof event & { timezone?: string | null }).timezone)}</div>
              ${organizer ? `<div style="color:#D9D0C0;font-size:11px;margin-bottom:4px;">${escapeHtml(organizer.name)}</div>` : ""}
              <a href="/events/${event.id}" style="color:#E8622A;font-size:12px;text-decoration:none;font-weight:500;">View event →</a>
            `;
          }).join("")}
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: svgIcon }).addTo(layer);

      if (isMultiLocation) {
        // Clicking a multi-location cluster zooms in until it splits
        marker.on("click", () => {
          const bounds = L.latLngBounds(cluster.locations.map((l) => [l.lat, l.lng]));
          map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 0.6 });
        });
      } else {
        const popup = L.popup({
          className: "litly-popup",
          closeButton: false,
          maxWidth: 280,
        }).setContent(popupContent);
        marker.bindPopup(popup);
      }
    });

    // Fit bounds to filtered events (only on initial load without radius —
    // not on zoom-driven redraws, which would snap the view back)
    if (!userLoc && filtered.length > 0 && !didFitRef.current) {
      didFitRef.current = true;
      const bounds = L.latLngBounds(filtered.filter(e => e.lat && e.lng).map((e) => [e.lat!, e.lng!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [events, userLoc, radius, mapReady, zoom]);

  function handleLocate() {
    if (!navigator.geolocation) { setLocError(true); return; }
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        mapRef.current?.flyTo([lat, lng], 12, { duration: 1 });
        setUserLoc({ lat, lng });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocError(true);
      }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Use my location button — always visible until location is granted */}
        {!userLoc && (
          <button
            onClick={handleLocate}
            disabled={locating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-cream/20 text-cream-muted hover:border-orange hover:text-orange transition disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z" />
              <circle cx="12" cy="8.5" r="2.5" />
            </svg>
            {locating ? "Locating…" : "Use my location"}
          </button>
        )}
        {locError && (
          <span className="text-sm text-cream-muted">Location unavailable — check browser permissions.</span>
        )}

        {/* Radius filter — only shown once location is known */}
        {userLoc && (
          <>
            <span className="text-cream-muted text-sm">Distance:</span>
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setRadius(opt.miles)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition border ${
                  radius === opt.miles
                    ? "bg-orange text-cream border-orange"
                    : "border-cream/20 text-cream-muted hover:border-orange hover:text-orange"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </>
        )}
      </div>

      <div
        ref={containerRef}
        className="w-full rounded-2xl overflow-hidden border border-cream/10"
        style={{ height: "calc(100vh - 260px)", minHeight: 400 }}
      />
    </div>
  );
}
