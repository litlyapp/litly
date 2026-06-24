import Link from "next/link";

export interface CalendarCell {
  key: string; // YYYY-MM-DD
  day: number;
  inMonth: boolean;
  count: number;
  isToday: boolean;
  isPast: boolean;
  href: string | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarGrid({
  monthLabel,
  prevHref,
  nextHref,
  cells,
  maxCount,
}: {
  monthLabel: string;
  prevHref: string | null;
  nextHref: string;
  cells: CalendarCell[];
  maxCount: number;
}) {
  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        {prevHref ? (
          <Link
            href={prevHref}
            aria-label="Previous month"
            className="text-cream-muted hover:text-orange px-3 py-1.5 rounded-full hover:bg-navy-light transition text-lg"
          >
            ‹
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-cream-muted/25 text-lg select-none">‹</span>
        )}
        <h2 className="font-serif text-2xl text-cream">{monthLabel}</h2>
        <Link
          href={nextHref}
          aria-label="Next month"
          className="text-cream-muted hover:text-orange px-3 py-1.5 rounded-full hover:bg-navy-light transition text-lg"
        >
          ›
        </Link>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-cream-muted text-xs uppercase tracking-wider py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => (
          <CalendarDay key={c.key} cell={c} maxCount={maxCount} />
        ))}
      </div>
    </div>
  );
}

function CalendarDay({ cell, maxCount }: { cell: CalendarCell; maxCount: number }) {
  const { day, inMonth, count, isToday, isPast, href } = cell;

  // Days from adjacent months render as empty placeholders to keep the weekday
  // columns aligned without showing other-month dates.
  if (!inMonth) {
    return <div className="min-h-[68px] sm:min-h-[88px]" aria-hidden />;
  }

  // Heat-map intensity: scaled to the busiest day in view so small counts still
  // show contrast at current data volumes.
  const intensity = count > 0 ? 0.14 + 0.5 * (count / maxCount) : 0;
  const style =
    count > 0 ? { backgroundColor: `rgba(232, 98, 42, ${intensity})` } : undefined;

  const base = `relative rounded-xl border min-h-[68px] sm:min-h-[88px] p-2 flex flex-col ${
    isToday ? "border-orange" : "border-cream/10"
  } ${!inMonth ? "opacity-40" : ""} ${isPast ? "opacity-30" : ""}`;

  const inner = (
    <>
      <span className={`text-sm ${isToday ? "text-orange font-semibold" : "text-cream"}`}>
        {day}
      </span>
      {count > 0 && (
        <span className="mt-auto text-xs text-cream/90 font-medium">
          {count > 99 ? "99+" : count} {count === 1 ? "event" : "events"}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} style={style} className={`${base} hover:border-orange/60 transition`}>
        {inner}
      </Link>
    );
  }
  return (
    <div style={style} className={base}>
      {inner}
    </div>
  );
}
