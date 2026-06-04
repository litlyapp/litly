// Parse ISO datetime as local time (ignore UTC offset) so events
// always display in the timezone they were entered, not the viewer's timezone.
function parseLocal(iso: string): Date {
  // Strip timezone info and parse as local
  const local = iso.replace("Z", "").replace(/([+-]\d{2}:\d{2})$/, "").replace("+00", "");
  return new Date(local);
}

export function formatEventDate(iso: string): string {
  const d = parseLocal(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEventTime(iso: string): string {
  const d = parseLocal(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatEventDateTime(iso: string): string {
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
