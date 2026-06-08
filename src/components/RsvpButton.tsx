"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

interface Props {
  eventId: string;
  initialRsvp: boolean;
  user: User | null;
}

export default function RsvpButton({ eventId, initialRsvp, user }: Props) {
  const [rsvp, setRsvp] = useState(initialRsvp);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    if (!user) {
      router.push("/login");
      return;
    }

    setLoading(true);
    const next = !rsvp;
    setRsvp(next);

    await fetch("/api/rsvp", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });

    setLoading(false);
    startTransition(() => router.refresh());
  }

  if (rsvp) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-orange text-sm font-medium">✓ You&apos;re going</span>
        <button
          onClick={toggle}
          disabled={loading}
          className="text-cream-muted text-sm hover:text-cream border border-cream/20 rounded-full px-4 py-1.5 transition"
        >
          Cancel RSVP
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition disabled:opacity-60"
    >
      {loading ? "…" : "RSVP to this event"}
    </button>
  );
}
