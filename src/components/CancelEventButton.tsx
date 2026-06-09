"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  eventId: string;
  isRecurring: boolean;
}

export default function CancelEventButton({ eventId, isRecurring }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [scope, setScope] = useState<"this" | "series">("this");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setCancelling(true);
    const endpoint = scope === "series"
      ? `/api/events/${eventId}/cancel-series`
      : `/api/events/${eventId}/cancel`;

    const res = await fetch(endpoint, { method: "POST" });
    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const body = await res.json();
      setError(body.error ?? "Failed to cancel.");
      setCancelling(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full py-3 rounded-full border border-orange/40 text-orange text-sm font-medium hover:bg-orange/10 transition"
      >
        Cancel this event
      </button>
    );
  }

  return (
    <div className="bg-orange/10 border border-orange/30 rounded-2xl p-5 space-y-4">
      <p className="text-cream text-sm font-medium">Cancel this event?</p>

      {isRecurring && (
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
        {scope === "series"
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
          {cancelling ? "Cancelling…" : scope === "series" ? "Cancel entire series" : "Cancel this occurrence"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm"
        >
          Keep event
        </button>
      </div>
    </div>
  );
}
