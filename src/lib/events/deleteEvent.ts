// Permanently delete an event. A live, upcoming event is cancelled first so
// RSVPd patrons still get the cancellation email before the row disappears.
// Returns an error message, or null on success.
export async function deleteEvent({
  id,
  cancelFirst,
}: {
  id: string;
  cancelFirst: "none" | "this" | "series";
}): Promise<string | null> {
  try {
    if (cancelFirst !== "none") {
      const endpoint = cancelFirst === "series" ? "cancel-series" : "cancel";
      const res = await fetch(`/api/events/${id}/${endpoint}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return body.error ?? "Failed to cancel event before deleting.";
      }
    }
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.error ?? "Failed to delete.";
    }
    return null;
  } catch {
    return "Network error. Check your connection and try again.";
  }
}
