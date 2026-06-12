export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly_date" | "monthly_day";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  day_of_week?: number;   // 0=Sun … 6=Sat (for weekly/biweekly/monthly_day)
  week_of_month?: number; // 1-4 or -1 (last) — for monthly_day
  weeks_of_month?: number[]; // multiple ordinals, e.g. [2, 4] = 2nd and 4th — supersedes week_of_month when present
  until: string;          // "YYYY-MM-DD"
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["", "1st", "2nd", "3rd", "4th"];

function ordinalSuffix(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** Which occurrence of its weekday is this date within its month? (1-based; returns -1 if it's the last) */
export function getWeekOfMonth(date: Date): number {
  const target = date.getDay();
  let count = 0;
  for (let d = 1; d <= date.getDate(); d++) {
    if (new Date(date.getFullYear(), date.getMonth(), d).getDay() === target) count++;
  }
  // Check if there's another occurrence later in the month
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
  if (next.getMonth() !== date.getMonth()) return -1; // it's the last one
  return count;
}

function getNthWeekdayInMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  weekOfMonth: number
): Date | null {
  if (weekOfMonth === -1) {
    const last = new Date(year, month + 1, 0);
    while (last.getDay() !== dayOfWeek) last.setDate(last.getDate() - 1);
    return last;
  }
  const first = new Date(year, month, 1);
  const offset = (dayOfWeek - first.getDay() + 7) % 7;
  const result = new Date(year, month, 1 + offset + (weekOfMonth - 1) * 7);
  if (result.getMonth() !== month) return null;
  return result;
}

/**
 * Generate all occurrence dates AFTER startDate up to (and including) rule.until.
 * startDate is the first occurrence (not returned — already exists as the parent event).
 */
export function generateOccurrenceDates(startDate: Date, rule: RecurrenceRule): Date[] {
  const until = new Date(rule.until + "T23:59:59");
  const h = startDate.getHours();
  const m = startDate.getMinutes();
  const dates: Date[] = [];

  if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
    const interval = rule.frequency === "weekly" ? 7 : 14;
    const cur = new Date(startDate);
    cur.setDate(cur.getDate() + interval);
    while (cur <= until) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + interval);
    }
  } else if (rule.frequency === "monthly_date") {
    let year = startDate.getFullYear();
    // Start at next month. getMonth()+1 produces 1–12 (1-based), but new Date(year, month, ...)
    // accepts values outside 0–11 and overflows correctly (e.g. month=12 → January next year).
    // The guard `if (month > 11)` handles the December parent case (getMonth()=11, +1=12).
    let month = startDate.getMonth() + 1;
    if (month > 11) { month = 0; year++; }
    while (true) {
      const d = new Date(year, month, startDate.getDate(), h, m);
      if (d.getMonth() !== month) d.setDate(0); // overflow → last day of month
      if (d > until) break;
      dates.push(new Date(d));
      month++;
      if (month > 11) { month = 0; year++; }
    }
  } else if (rule.frequency === "monthly_day") {
    const weeks = rule.weeks_of_month?.length
      ? rule.weeks_of_month
      : rule.week_of_month !== undefined
        ? [rule.week_of_month]
        : [];
    if (rule.day_of_week === undefined || weeks.length === 0) return dates;
    // Start in the parent's own month: with multiple ordinals (e.g. 2nd and
    // 4th Friday) a later occurrence can still fall in the start month
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    while (true) {
      const monthFirst = new Date(year, month, 1);
      if (monthFirst > until) break;
      for (const week of weeks) {
        const d = getNthWeekdayInMonth(year, month, rule.day_of_week, week);
        if (d) {
          d.setHours(h, m, 0, 0);
          if (d > startDate && d <= until) dates.push(d);
        }
      }
      month++;
      if (month > 11) { month = 0; year++; }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
  }

  return dates;
}

/** Returns the single next occurrence after afterDate, or null if none possible. */
export function generateNextOccurrence(afterDate: Date, rule: RecurrenceRule): Date | null {
  const farFuture = new Date(afterDate);
  farFuture.setFullYear(farFuture.getFullYear() + 10);
  const extendedRule: RecurrenceRule = { ...rule, until: farFuture.toISOString().slice(0, 10) };
  const dates = generateOccurrenceDates(afterDate, extendedRule);
  return dates[0] ?? null;
}

export function describeRule(startDate: Date, rule: RecurrenceRule): string {
  switch (rule.frequency) {
    case "weekly":
      return `Every ${DAY_NAMES[startDate.getDay()]}`;
    case "biweekly":
      return `Every other ${DAY_NAMES[startDate.getDay()]}`;
    case "monthly_date": {
      const n = startDate.getDate();
      return `Monthly on the ${n}${ordinalSuffix(n)}`;
    }
    case "monthly_day": {
      const weeks = rule.weeks_of_month?.length
        ? rule.weeks_of_month
        : rule.week_of_month !== undefined
          ? [rule.week_of_month]
          : [];
      if (rule.day_of_week === undefined || weeks.length === 0) return "";
      // "last" (-1) sorts after the numbered ordinals
      const ordinals = [...weeks]
        .sort((a, b) => (a === -1 ? 1 : b === -1 ? -1 : a - b))
        .map((w) => (w === -1 ? "last" : (ORDINALS[w] ?? `${w}th`)));
      const list =
        ordinals.length === 1
          ? ordinals[0]
          : `${ordinals.slice(0, -1).join(", ")} and ${ordinals[ordinals.length - 1]}`;
      return `Monthly on the ${list} ${DAY_NAMES[rule.day_of_week]}`;
    }
  }
}
