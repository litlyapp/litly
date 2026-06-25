"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
  isRecurring: boolean;
  isDraft?: boolean;
}

export default function CancelEventButton({ eventId, isRecurring, isDraft }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [scope, setScope] = useState<"this" | "series">("this");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setCancelling(true);
    const endpoint = isDraft
      ? `/api/events/${eventId}`
      : scope === "series"
        ? `/api/events/${eventId}/cancel-series`
        : `/api/events/${eventId}/cancel`;
    const method = isDraft ? "DELETE" : "POST";

    try {
      const res = await fetch(endpoint, { method });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const body = await res.json();
        if (res.status === 403) {
          alert(body.error ?? "Only org admins can cancel events.");
          setConfirming(false);
          setCancelling(false);
          return;
        }
        setError(body.error ?? "Failed to cancel.");
        setCancelling(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setCancelling(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-3 rounded-full border border-orange/40 text-orange text-sm font-medium hover:bg-orange/10 transition"
      >
        {isDraft ? "Delete draft" : "Cancel this event"}
      </button>
    );
  }

  return (
    <div className="bg-orange/10 border border-orange/30 rounded-2xl p-5 space-y-4">
      <p className="text-cream text-sm font-medium">{isDraft ? "Delete this draft?" : "Cancel this event?"}</p>

      {!isDraft && isRecurring && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="cancelScope"
              value="this"
              checked={scope === "this"}
              onChange={() => setScope("this")}
              className="accent-orange"
            />
            <span className="text-cream text-sm">This occurrence only</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="cancelScope"
              value="series"
              checked={scope === "series"}
              onChange={() => setScope("series")}
              className="accent-orange"
            />
            <span className="text-cream text-sm">Entire series (all upcoming occurrences)</span>
          </label>
        </div>
      )}

      <p className="text-cream-muted text-xs">
        {isDraft
          ? "This cannot be undone."
          : scope === "series"
            ? "All upcoming occurrences will be cancelled and RSVPd patrons notified."
            : "RSVPd patrons will be notified. This cannot be undone."}
      </p>

      {error && <p className="text-orange text-xs">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
        >
          {isDraft
            ? (cancelling ? "Deleting…" : "Yes, delete draft")
            : (cancelling ? "Cancelling…" : scope === "series" ? "Cancel entire series" : "Cancel this occurrence")}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm"
        >
          {isDraft ? "Keep draft" : "Keep event"}
        </button>
      </div>
    </div>
  );
}
