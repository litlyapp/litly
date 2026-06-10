"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  organizerId: string;
  initialFollowing: boolean;
}

export default function FollowButton({
  organizerId,
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

    // Always resolve the current user server-side — never trust a prop for auth-sensitive writes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFollowing(!next);
      setLoading(false);
      router.push("/login"); // logged out — send to login instead of silently doing nothing
      return;
    }

    let error;
    if (next) {
      ({ error } = await supabase.from("follows").insert({ patron_id: user.id, organizer_id: organizerId }));
    } else {
      ({ error } = await supabase.from("follows").delete().eq("patron_id", user.id).eq("organizer_id", organizerId));
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
