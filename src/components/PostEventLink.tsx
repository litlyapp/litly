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
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          setHref(data?.role === "organizer" ? "/events/new" : "/become-organizer");
        });
    });
  }, []);

  return (
    <Link href={href} className={className}>
      Post an event
    </Link>
  );
}
