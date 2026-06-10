"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EventViewTracker({ eventId }: { eventId: string }) {
  useEffect(() => {
    // Only count once per session per event
    const key = `viewed:${eventId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    const supabase = createClient();
    // The Supabase query builder is lazy — the request only fires when the
    // builder is awaited or .then() is called, so fire-and-forget needs .then()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .rpc("increment_event_view", { event_id: eventId })
      .then(({ error }: { error: unknown }) => {
        if (error) console.error("[EventViewTracker] increment failed:", error);
      });
  }, [eventId]);

  return null;
}
