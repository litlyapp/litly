"use client";

import { useMemo } from "react";
import {
  type RecurrenceRule,
  type RecurrenceFrequency,
  generateOccurrenceDates,
  describeRule,
  getWeekOfMonth,
} from "@/lib/recurrence";

interface Props {
  startDateIso: string;
  value: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  ongoing: boolean;
  onOngoingChange: (v: boolean) => void;
}

const UNTIL_PRESETS = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
];

function addMonths(date: Date, n: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default function RecurrenceOptions({ startDateIso, value, onChange, ongoing, onOngoingChange }: Props) {
  const startDate = startDateIso ? new Date(startDateIso) : null;

  const defaultUntil = startDate ? addMonths(startDate, 6) : "";

  function enable() {
    if (!startDate) return;
    const wom = getWeekOfMonth(startDate);
    onChange({
      frequency: "monthly_day",
      day_of_week: startDate.getDay(),
      week_of_month: wom,
      until: defaultUntil,
    });
  }

  function disable() {
    onChange(null);
  }

  function setFrequency(freq: RecurrenceFrequency) {
    if (!value || !startDate) return;
    const wom = getWeekOfMonth(startDate);
    onChange({
      ...value,
      frequency: freq,
      day_of_week: startDate.getDay(),
      week_of_month: freq === "monthly_day" ? wom : undefined,
    });
  }

  function setUntilPreset(months: number) {
    if (!value || !startDate) return;
    onChange({ ...value, until: addMonths(startDate, months) });
  }

  function setUntilCustom(dateStr: string) {
    if (!value) return;
    onChange({ ...value, until: dateStr });
  }

  const preview = useMemo(() => {
    if (!value || !startDate) return null;
    const dates = generateOccurrenceDates(startDate, value);
    const description = describeRule(startDate, value);
    return { description, count: dates.length };
  }, [value, startDate]);

  const labelClass = "block text-cream-muted text-xs uppercase tracking-wider mb-1.5";
  const pillBase = "px-3 py-1 rounded-full text-sm border transition";
  const pillActive = "bg-orange border-orange text-cream";
  const pillInactive = "border-cream/20 text-cream-muted hover:border-cream hover:text-cream";

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={value ? disable : enable}
          disabled={!startDateIso}
          className={`w-11 h-6 rounded-full border transition relative shrink-0 ${
            value ? "bg-orange border-orange" : "bg-navy-light border-cream/30"
          } disabled:opacity-40`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
              value ? "left-5" : "left-0.5"
            }`}
          />
        </button>
        <span className="text-cream text-sm font-medium">
          Repeat this event
          {!startDateIso && (
            <span className="text-cream-muted font-normal ml-1">(set a date first)</span>
          )}
        </span>
      </label>

      {value && startDate && (
        <div className="bg-navy border border-cream/10 rounded-2xl p-5 space-y-5">
          {/* Frequency */}
          <div>
            <label className={labelClass}>Frequency</label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { freq: "weekly" as RecurrenceFrequency, label: "Weekly" },
                  { freq: "biweekly" as RecurrenceFrequency, label: "Every 2 weeks" },
                  { freq: "monthly_day" as RecurrenceFrequency, label: "Monthly (by day)" },
                  { freq: "monthly_date" as RecurrenceFrequency, label: "Monthly (by date)" },
                ] as const
              ).map(({ freq, label }) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`${pillBase} ${value.frequency === freq ? pillActive : pillInactive}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {value.frequency === "monthly_day" && value.day_of_week !== undefined && value.week_of_month !== undefined && (
              <p className="text-cream-muted text-xs mt-2">
                {describeRule(startDate, value)} — based on your selected date
              </p>
            )}
          </div>

          {/* Ongoing toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={ongoing}
              onClick={() => onOngoingChange(!ongoing)}
              className={`w-11 h-6 rounded-full border transition relative shrink-0 ${
                ongoing ? "bg-orange border-orange" : "bg-navy-light border-cream/30"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
                  ongoing ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            <div>
              <span className="text-cream text-sm font-medium">Ongoing series</span>
              <p className="text-cream-muted text-xs">litly tops up occurrences automatically — no fixed end date needed.</p>
            </div>
          </label>

          {/* Until — hidden when ongoing */}
          {!ongoing && (
            <div>
              <label className={labelClass}>Repeat until</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {UNTIL_PRESETS.map(({ label, months }) => {
                  const target = addMonths(startDate, months);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setUntilPreset(months)}
                      className={`${pillBase} ${value.until === target ? pillActive : pillInactive}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                type="date"
                value={value.until}
                min={startDateIso.slice(0, 10)}
                onChange={(e) => setUntilCustom(e.target.value)}
                className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange [color-scheme:dark]"
              />
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-orange/10 border border-orange/20 rounded-xl px-4 py-3 text-sm">
              <span className="text-orange font-medium">{preview.description}</span>
              <span className="text-cream-muted ml-2">
                {ongoing
                  ? "— ongoing, litly will keep this series topped up"
                  : `— ${preview.count} additional ${preview.count === 1 ? "occurrence" : "occurrences"} will be created`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
