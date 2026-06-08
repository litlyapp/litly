import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface OrganizerRow {
  id: string;
  name: string;
  bio: string | null;
  org_type: string;
  avatar_url: string | null;
}

interface FollowRow {
  organizer_id: string;
  organizer: OrganizerRow | OrganizerRow[] | null;
}

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/following");

  const { data: followRows } = await supabase
    .from("follows")
    .select<string, FollowRow>(
      `
      organizer_id,
      organizer:organizer_profiles(id, name, bio, org_type, avatar_url)
    `
    )
    .eq("patron_id", user.id)
    .order("created_at", { ascending: false });

  const organizers = (followRows ?? [])
    .map((r) => (Array.isArray(r.organizer) ? r.organizer[0] : r.organizer))
    .filter(Boolean) as OrganizerRow[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Following</h1>
        <p className="text-cream-muted">
          {organizers.length === 0
            ? "Not following anyone yet."
            : `${organizers.length} organizer${organizers.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {organizers.length === 0 && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-16 text-center">
          <p className="font-serif text-2xl text-cream mb-3">No follows yet</p>
          <p className="text-cream-muted text-sm max-w-xs mx-auto">
            Follow an organizer from their profile page to see their events here.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {organizers.map((org) => (
          <Link
            key={org.id}
            href={`/organizers/${org.id}`}
            className="flex items-center gap-4 bg-navy-light border border-cream/10 rounded-2xl p-4 hover:border-orange/40 transition"
          >
            {org.avatar_url ? (
              <Image
                src={org.avatar_url}
                alt={org.name}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-orange/15 text-orange font-serif text-lg flex items-center justify-center shrink-0">
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-cream font-medium truncate">{org.name}</p>
              <p className="text-cream-muted text-xs capitalize">{org.org_type.replace(/_/g, " ")}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
