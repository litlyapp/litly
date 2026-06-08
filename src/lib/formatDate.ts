// Parse ISO datetime as local time (ignore UTC offset) — legacy fallback for
// events saved before the timezone field existed (where date_time was stored
// as a naive local-time value masquerading as UTC).
function parseLocal(iso: string): Date {
  const local = iso.replace("Z", "").replace(/([+-]\d{2}:\d{2})$/, "").replace("+00", "");
  return new Date(local);
}

// When a timezone is provided, format the true UTC instant as wall-clock time
// in that timezone (so the event always displays at the time the organizer
// entered, regardless of the viewer's location). Without a timezone, fall
// back to the legacy "treat stored value as local" behavior.

export function formatEventDate(iso: string, timeZone?: string | null): string {
  if (timeZone) {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
  }
  const d = parseLocal(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventTime(iso: string, timeZone?: string | null): string {
  if (timeZone) {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
  }
  const d = parseLocal(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventDateTime(iso: string, timeZone?: string | null): string {
  if (timeZone) {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
  }
  const d = parseLocal(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
