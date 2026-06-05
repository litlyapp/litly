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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("increment_event_view", { event_id: eventId });
  }, [eventId]);

  return null;
}
