"use client";

// Separate date + time selects — avoids Safari's buggy datetime-local picker

interface Props {
  value: string; // "YYYY-MM-DDTHH:MM" or ""
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i).padStart(2, "0"),
  label: new Date(2000, 0, 1, i).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }),
}));

const MINUTES = ["00", "15", "30", "45"];

function parseValue(value: string) {
  if (!value) return { date: "", hour: "19", minute: "00" };
  const [datePart, timePart] = value.split("T");
  const [hour, minute] = (timePart ?? "19:00").split(":");
  return {
    date: datePart ?? "",
    hour: hour ?? "19",
    minute: minute?.slice(0, 2) ?? "00",
  };
}

function buildValue(date: string, hour: string, minute: string): string {
  if (!date) return "";
  return `${date}T${hour}:${minute}`;
}

export default function DateTimePicker({ value, onChange, label, required }: Props) {
  const { date, hour, minute } = parseValue(value);

  const inputClass =
    "bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange";

  return (
    <div>
      <label className="block text-cream-muted text-xs uppercase tracking-wider mb-1.5">
        {label}{required && " *"}
      </label>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => onChange(buildValue(e.target.value, hour, minute))}
          required={required}
          className={`${inputClass} flex-1 [color-scheme:dark]`}
        />
        <select
          value={hour}
          onChange={(e) => onChange(buildValue(date, e.target.value, minute))}
          className={`${inputClass} w-28`}
        >
          {HOURS.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label.replace(":00", "").replace(":15", ":15").replace(":30", ":30").replace(":45", ":45")}
            </option>
          ))}
        </select>
        <select
          value={minute}
          onChange={(e) => onChange(buildValue(date, hour, e.target.value))}
          className={`${inputClass} w-20`}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>:{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
