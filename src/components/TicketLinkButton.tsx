"use client";

import { createClient } from "@/lib/supabase/client";

interface Props {
  eventId: string;
  href: string;
  label: string;
}

export default function TicketLinkButton({ eventId, href, label }: Props) {
  function handleClick() {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("increment_ticket_click", { event_id: eventId });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition"
    >
      {label}
    </a>
  );
}
