"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * List ↔ Map toggle that preserves the current filter query string, so
 * switching views keeps the patron's filters intact.
 */
export default function ViewToggle({ active }: { active: "list" | "map" }) {
  const searchParams = useSearchParams();

  // List link: carry everything except map-only location-centering params.
  const listParams = new URLSearchParams(searchParams.toString());
  listParams.delete("lat");
  listParams.delete("lng");
  const listQs = listParams.toString();
  const listHref = `/events${listQs ? `?${listQs}` : ""}`;

  // Map link: also drop `type`, since the map only shows in-person events and
  // hides the Type filter — a stale type=virtual would silently empty the map.
  const mapParams = new URLSearchParams(listParams.toString());
  mapParams.delete("type");
  const mapQs = mapParams.toString();
  const mapHref = `/events/map${mapQs ? `?${mapQs}` : ""}`;

  return (
    <div className="inline-flex rounded-full border border-cream/20 p-0.5 text-sm">
      <Link
        href={listHref}
        className={`px-4 py-1.5 rounded-full transition ${
          active === "list"
            ? "bg-orange text-cream"
            : "text-cream-muted hover:text-cream"
        }`}
      >
        List
      </Link>
      <Link
        href={mapHref}
        className={`px-4 py-1.5 rounded-full transition ${
          active === "map"
            ? "bg-orange text-cream"
            : "text-cream-muted hover:text-cream"
        }`}
      >
        Map
      </Link>
    </div>
  );
}
