"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  initialSaved: boolean;
}

export default function SaveButton({ eventId, initialSaved }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const next = !saved;
    setSaved(next);

    if (next) {
      await supabase.from("saved_events").insert({ user_id: user.id, event_id: eventId });
    } else {
      await supabase
        .from("saved_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", eventId);
    }

    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      aria-label={saved ? "Unsave event" : "Save event"}
      className="text-cream-muted hover:text-orange transition"
    >
      <svg
        className="w-5 h-5"
        fill={saved ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        style={{ color: saved ? "#E8622A" : undefined }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}
