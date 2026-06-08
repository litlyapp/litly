"use client";

import { useState, useRef, useEffect } from "react";
import { formatEventDateTime } from "@/lib/formatDate";

interface Props {
  eventId: string;
  dateTime: string;
  endTime?: string | null;
  timeZone?: string | null;
  title: string;
  description?: string | null;
  location?: string;
}

// Format the true UTC instant as a UTC-suffixed string ("...Z") so Google
// Calendar (and other ICS consumers) interpret it correctly regardless of
// the viewer's own timezone.
function toGCalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export default function AddToCalendarButton({ eventId, dateTime, endTime, timeZone, title, description, location }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const gcalUrl = (() => {
    const start = toGCalDate(dateTime);
    const end = endTime ? toGCalDate(endTime) : start;
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${start}/${end}`,
      ...(description ? { details: description } : {}),
      ...(location ? { location } : {}),
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  })();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 text-cream hover:text-orange transition group w-full text-left"
        title="Add to calendar"
      >
        <CalendarIcon />
        <div>
          <div className="group-hover:underline">{formatEventDateTime(dateTime, timeZone)}</div>
          {endTime && (
            <div className="text-cream-muted text-sm">Until {formatEventDateTime(endTime, timeZone)}</div>
          )}
        </div>
      </button>

      {open && (
        <div className="absolute left-8 top-full mt-2 z-10 bg-navy-light border border-cream/20 rounded-xl shadow-lg overflow-hidden min-w-[200px]">
          <a
            href={gcalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-cream hover:bg-cream/10 transition"
          >
            <GoogleCalIcon />
            Google Calendar
          </a>
          <a
            href={`/api/events/${eventId}/calendar`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm text-cream hover:bg-cream/10 transition"
          >
            <IcsIcon />
            Apple / Outlook
          </a>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5 text-orange shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function GoogleCalIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-cream-muted" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zm-7 13.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
    </svg>
  );
}

function IcsIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-cream-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  );
}
