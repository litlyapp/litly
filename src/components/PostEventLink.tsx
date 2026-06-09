"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PostEventLink({ className }: { className?: string }) {
  const [href, setHref] = useState("/register");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("organizer_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setHref(data ? "/events/new" : "/become-organizer");
        });
    });
  }, []);

  return (
    <Link href={href} className={className}>
      Post an event
    </Link>
  );
}
