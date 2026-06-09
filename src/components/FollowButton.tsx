"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  organizerId: string;
  patronId: string;
  initialFollowing: boolean;
}

export default function FollowButton({
  organizerId,
  patronId,
  initialFollowing,
}: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  async function toggle() {
    setLoading(true);
    const next = !following;
    setFollowing(next);

    let error;
    if (next) {
      ({ error } = await supabase.from("follows").insert({ patron_id: patronId, organizer_id: organizerId }));
    } else {
      ({ error } = await supabase.from("follows").delete().eq("patron_id", patronId).eq("organizer_id", organizerId));
    }

    if (error) { setFollowing(!next); setLoading(false); return; }
    setLoading(false);
    startTransition(() => router.refresh());
  }

  if (following) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="shrink-0 px-5 py-2 rounded-full border border-cream/20 text-cream-muted text-sm hover:border-orange hover:text-orange transition disabled:opacity-60"
      >
        Following
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="shrink-0 px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
    >
      Follow
    </button>
  );
}
