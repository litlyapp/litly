// Wall-clock ↔ UTC conversion in an explicit IANA timezone, independent of
// the runtime's own locale (browser or server). Shared by EventForm and the
// daily-series cron so recurring occurrences land on the same wall-clock
// time in the event's timezone across DST changes.

// Offset (ms) to add to a UTC instant to get the wall-clock time in `timeZone`
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

// Extract the wall-clock "YYYY-MM-DDTHH:MM" components from a Date object (runtime-local interpretation)
export function dateToWallClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert a "YYYY-MM-DDTHH:MM" wall-clock string in `timeZone` to a UTC ISO string
export function zonedToUtcIso(local: string, timeZone: string): string {
  if (!local) return "";
  const naive = new Date(`${local}:00Z`); // treat the wall-clock as if it were UTC
  const offset = tzOffsetMs(naive, timeZone);
  return new Date(naive.getTime() - offset).toISOString();
}

// Convert a UTC ISO string to a "YYYY-MM-DDTHH:MM" wall-clock string in `timeZone`
export function utcIsoToZoned(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
