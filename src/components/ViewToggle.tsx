"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

/**
 * List / Map / Calendar toggle that preserves the current filter query string,
 * so switching views keeps the patron's filters intact. View-specific params
 * are dropped when they don't apply to the target view.
 */
export default function ViewToggle({
  active,
}: {
  active: "list" | "map" | "calendar";
}) {
  const searchParams = useSearchParams();

  // Map-only location-centering params never carry across.
  const base = new URLSearchParams(searchParams.toString());
  base.delete("lat");
  base.delete("lng");

  function href(path: string, drop: string[]) {
    const p = new URLSearchParams(base.toString());
    drop.forEach((k) => p.delete(k));
    const qs = p.toString();
    return qs ? `${path}?${qs}` : path;
  }

  const tabs = [
    // List & calendar own the date filters; the calendar uses `month` instead.
    { key: "list", label: "List", href: href("/events", ["month"]) },
    // Map hides Type and only shows in-person, so drop those + date range.
    { key: "map", label: "Map", href: href("/events/map", ["month", "type", "from", "to"]) },
    // Calendar uses `month` for the date range, so drop from/to.
    { key: "calendar", label: "Calendar", href: href("/events/calendar", ["from", "to"]) },
  ] as const;

  return (
    <div className="inline-flex rounded-full border border-cream/20 p-0.5 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-4 py-1.5 rounded-full transition ${
            active === t.key
              ? "bg-orange text-cream"
              : "text-cream-muted hover:text-cream"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
