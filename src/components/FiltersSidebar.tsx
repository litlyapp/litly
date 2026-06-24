"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import EventFilters from "./EventFilters";

interface Organizer {
  id: string;
  name: string;
  avatar_url?: string | null;
}

/**
 * Wraps EventFilters so the panel is a collapsible "Filters" button on mobile
 * (collapsed by default, so content is visible without scrolling) while staying
 * an always-open sidebar on desktop (lg+).
 */
export default function FiltersSidebar({
  organizers,
  hideType,
  hideDateRange,
  clearHref,
}: {
  organizers: Organizer[];
  hideType?: boolean;
  hideDateRange?: boolean;
  clearHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const sp = useSearchParams();

  // Count active filter groups so the collapsed button can show "Filters · 2".
  const count =
    (sp.get("q") ? 1 : 0) +
    (sp.get("location") ? 1 : 0) +
    (sp.getAll("genre").length > 0 ? 1 : 0) +
    (sp.get("type") && sp.get("type") !== "all" ? 1 : 0) +
    (sp.get("from") ? 1 : 0) +
    (sp.get("to") ? 1 : 0) +
    (sp.get("organizer") ? 1 : 0);

  return (
    <aside className="lg:w-64 lg:shrink-0">
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="lg:hidden w-full flex items-center justify-between bg-navy-light border border-cream/15 rounded-xl px-4 py-3 text-cream"
      >
        <span className="text-sm font-medium">
          Filters
          {count > 0 && <span className="text-orange"> · {count}</span>}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Panel: collapsed on mobile unless toggled; always open on desktop */}
      <div className={`${open ? "block" : "hidden"} lg:block mt-3 lg:mt-0`}>
        <EventFilters
          organizers={organizers}
          hideType={hideType}
          hideDateRange={hideDateRange}
          clearHref={clearHref}
        />
      </div>
    </aside>
  );
}
