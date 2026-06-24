import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import FiltersSidebar from "@/components/FiltersSidebar";
import ViewToggle from "@/components/ViewToggle";
import CalendarGrid, { type CalendarCell } from "@/components/CalendarGrid";
import { applyEventFilters, type EventFilterParams } from "@/lib/events/filterQuery";

export const dynamic = "force-dynamic";

// Anchor "today" and the default month in a consistent US timezone (litly is
// US-focused). Individual events are still bucketed in their own timezone.
const APP_TZ = "America/New_York";

interface SearchParams extends EventFilterParams {
  month?: string; // YYYY-MM
}

/** YYYY-MM-DD for an instant, in the event's own timezone (fallback to app tz). */
function dayKey(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz || APP_TZ });
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: organizers } = await supabase
    .from("organizer_profiles")
    .select("id, name, avatar_url")
    .order("name");

  // Which month to display. "today" is anchored in APP_TZ.
  const todayKey = new Date().toLocaleDateString("en-CA", { timeZone: APP_TZ });
  const [ty, tm] = todayKey.split("-").map(Number);
  let year = ty;
  let month0 = tm - 1;
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [py, pm] = params.month.split("-").map(Number);
    year = py;
    month0 = pm - 1;
  }

  // Build a 6-week (42-day) grid starting on the Monday on/before the 1st.
  const first = new Date(Date.UTC(year, month0, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayOffset);

  // Only render the weeks this month actually spans (no fixed 6-week grid), so
  // trailing/leading days from adjacent months aren't shown.
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  const baseCells: { key: string; day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    baseCells.push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month0,
    });
  }

  // Query window: pad a day each side for timezone spillover; upcoming only.
  const nowIso = new Date().toISOString();
  const rangeStart = new Date(gridStart);
  rangeStart.setUTCDate(gridStart.getUTCDate() - 1);
  const rangeEnd = new Date(gridStart);
  rangeEnd.setUTCDate(gridStart.getUTCDate() + totalCells + 1);
  const lowerBound =
    rangeStart.toISOString() > nowIso ? rangeStart.toISOString() : nowIso;

  // Counts only — no event bodies — so the grid stays cheap at any volume.
  let query = supabase
    .from("events")
    .select("id, date_time, timezone")
    .eq("is_cancelled", false)
    .gte("date_time", lowerBound)
    .lt("date_time", rangeEnd.toISOString());

  // Apply shared filters EXCEPT from/to — the month grid is the date selector.
  const filterParams: EventFilterParams = {
    q: params.q,
    genre: params.genre,
    type: params.type,
    location: params.location,
    organizer: params.organizer,
  };
  query = applyEventFilters(query, filterParams, organizers ?? []);

  const { data: events } = await query;

  // Each occurrence counts on its own day (no series dedup — a weekly series
  // should appear on every week, which is the whole point of a calendar).
  const counts: Record<string, number> = {};
  for (const e of events ?? []) {
    const k = dayKey(e.date_time, e.timezone);
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // Carry the active filters onto day-click + month-nav links.
  const carry = new URLSearchParams();
  const genres = Array.isArray(params.genre)
    ? params.genre
    : params.genre
    ? [params.genre]
    : [];
  genres.forEach((g) => carry.append("genre", g));
  if (params.q) carry.set("q", params.q);
  if (params.type) carry.set("type", params.type);
  if (params.location) carry.set("location", params.location);
  if (params.organizer) carry.set("organizer", params.organizer);

  const cells: CalendarCell[] = baseCells.map((c) => {
    // Adjacent-month cells render blank — keep grid alignment, show nothing.
    if (!c.inMonth) {
      return { ...c, count: 0, isToday: false, isPast: false, href: null };
    }
    const isPast = c.key < todayKey;
    let href: string | null = null;
    if (!isPast) {
      const p = new URLSearchParams(carry.toString());
      p.set("from", c.key);
      p.set("to", c.key);
      p.set("ref", "calendar"); // so the list's "clear filters" returns here
      href = `/events?${p.toString()}`;
    }
    return {
      ...c,
      count: counts[c.key] ?? 0,
      isToday: c.key === todayKey,
      isPast,
      href,
    };
  });
  const maxCount = Math.max(1, ...cells.map((c) => c.count));

  // Month label + prev/next nav. No navigating before the current month — the
  // calendar is upcoming-only, so earlier months are always empty.
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const curYM = ty * 12 + (tm - 1);
  const thisYM = year * 12 + month0;
  const monthParam = (ym: number) =>
    `${Math.floor(ym / 12)}-${String((ym % 12) + 1).padStart(2, "0")}`;
  const monthHref = (ym: number) => {
    const p = new URLSearchParams(carry.toString());
    p.set("month", monthParam(ym));
    return `/events/calendar?${p.toString()}`;
  };
  const prevHref = thisYM > curYM ? monthHref(thisYM - 1) : null;
  const nextHref = monthHref(thisYM + 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="font-serif text-4xl text-cream mb-3">Event calendar</h1>
        <Suspense fallback={null}>
          <ViewToggle active="calendar" />
        </Suspense>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <Suspense fallback={<div className="lg:w-64 lg:shrink-0 text-cream-muted text-sm">Loading filters…</div>}>
          <FiltersSidebar organizers={organizers ?? []} hideDateRange />
        </Suspense>

        <div className="flex-1">
          <CalendarGrid
            monthLabel={monthLabel}
            prevHref={prevHref}
            nextHref={nextHref}
            cells={cells}
            maxCount={maxCount}
          />
        </div>
      </div>
    </div>
  );
}
