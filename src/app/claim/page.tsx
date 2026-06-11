import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClaimForm from "./ClaimForm";

export const metadata = {
  title: "Claim your event — litly",
  description: "Take over your organization's events and pages on litly.",
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: eventId } = await searchParams;
  const supabase = await createClient();

  let event: { id: string; title: string; source_name: string | null } | null = null;
  if (eventId) {
    const { data } = await supabase
      .from("events")
      .select("id, title, source_name, is_imported")
      .eq("id", eventId)
      .eq("is_imported", true)
      .single();
    if (data) event = data;
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl text-cream mb-4">Claim your event</h1>
        <p className="text-cream-muted leading-relaxed">
          litly curates literary events from newsletters and public calendars so
          readers can find them. If this is your event, claim it — you&apos;ll get a
          free organizer page, manage your own listings, and reach patrons who
          follow your work.
        </p>
      </div>

      {event ? (
        <ClaimForm
          eventId={event.id}
          eventTitle={event.title}
          sourceName={event.source_name}
        />
      ) : (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 text-center">
          <p className="text-cream-muted mb-4">
            That event couldn&apos;t be found — it may have been claimed already.
          </p>
          <Link href="/events" className="text-orange hover:underline text-sm">
            Browse events →
          </Link>
        </div>
      )}
    </div>
  );
}
