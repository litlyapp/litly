import type { Genre, EventType } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Shared event filter logic used by the events list, the map, and any other
 * view that needs to honor the same URL-driven filters. Keeping this in one
 * place means the list and map can't drift apart.
 */

export interface EventFilterParams {
  q?: string;
  genre?: string | string[];
  type?: string;
  from?: string;
  to?: string;
  organizer?: string;
  location?: string;
}

export interface OrganizerLite {
  id: string;
  name: string;
  avatar_url?: string | null;
}

// Imported events (crawled from an org's calendar feed or drafted via the URL
// importer) are almost never linked to a real organizer_profiles row — they're
// attributed to a single shared "Curated by litly" account, with the actual
// host name living only in the event's free-text `source_name`. Without this,
// the Organizer filter/typeahead can only ever match real signed-up
// organizers, so searching for e.g. "Malaprop's" silently finds nothing even
// though dozens of its events are on the site. We surface distinct
// `source_name` values as selectable pseudo-organizers, tagged with this
// prefix so applyEventFilters knows to match on source_name instead of
// organizer_id.
export const SOURCE_ORGANIZER_PREFIX = "source:";

/**
 * Combined list of filter options for the Organizer typeahead: real organizer
 * profiles plus a pseudo-entry for each distinct imported `source_name` among
 * upcoming, visible events.
 */
export async function getOrganizerFilterOptions(
  supabase: SupabaseClient<Database>
): Promise<OrganizerLite[]> {
  const [{ data: organizers }, { data: sourceRows }] = await Promise.all([
    supabase.from("organizer_profiles").select("id, name, avatar_url").order("name"),
    supabase
      .from("events")
      .select("source_name")
      .eq("is_imported", true)
      .eq("is_cancelled", false)
      .neq("is_published", false)
      .gte("date_time", new Date().toISOString())
      .not("source_name", "is", null),
  ]);

  const sourceNames = Array.from(
    new Set(
      (sourceRows ?? [])
        .map((r) => r.source_name)
        .filter((name): name is string => !!name)
    )
  ).sort((a, b) => a.localeCompare(b));

  const sourceOptions: OrganizerLite[] = sourceNames.map((name) => ({
    id: `${SOURCE_ORGANIZER_PREFIX}${name}`,
    name,
  }));

  return [...(organizers ?? []), ...sourceOptions];
}

/** Minimal shape of the Supabase query builder methods we chain. */
interface FilterableQuery<Q> {
  or: (filter: string) => Q;
  overlaps: (column: string, value: string[]) => Q;
  eq: (column: string, value: string) => Q;
  gte: (column: string, value: string) => Q;
  lte: (column: string, value: string) => Q;
}

/** Normalize the `genre` search param (string | string[] | undefined) to an array. */
export function parseGenres(genre?: string | string[]): string[] {
  if (!genre) return [];
  return Array.isArray(genre) ? genre : [genre];
}

/**
 * Apply the standard event filters (search, genre, type, date range, organizer,
 * location) to a Supabase events query. The query should already be scoped to
 * upcoming, non-cancelled events before calling this.
 */
export function applyEventFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  params: EventFilterParams,
  organizers: OrganizerLite[]
): Q {
  if (params.q) {
    // One search bar for everything a patron might type: event title, venue,
    // host org name, or an imported event's source org (claim-your-page funnel)
    const q = params.q.replace(/[,()]/g, " ");
    const ql = q.trim().toLowerCase();
    const matchingOrgIds = organizers
      .filter((o) => o.name.toLowerCase().includes(ql))
      .map((o) => o.id);
    const clauses = [
      `title.ilike.%${q}%`,
      `source_name.ilike.%${q}%`,
      `location_name.ilike.%${q}%`,
    ];
    if (matchingOrgIds.length) {
      clauses.push(`organizer_id.in.(${matchingOrgIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }

  const genres = parseGenres(params.genre);
  if (genres.length > 0) {
    // Match events whose genre array overlaps the selection, OR events with
    // no genre tagged at all (e.g. org-calendar-feed imports covering many
    // genres) — those are wildcards and should never be filtered out.
    const genreList = (genres as Genre[]).join(",");
    query = query.or(`genre.ov.{${genreList}},genre.eq.{}`);
  }

  if (params.type && params.type !== "all") {
    query = query.eq("event_type", params.type as EventType);
  }

  if (params.from) {
    query = query.gte("date_time", new Date(params.from).toISOString());
  }

  if (params.to) {
    const toDate = new Date(params.to);
    toDate.setHours(23, 59, 59, 999);
    query = query.lte("date_time", toDate.toISOString());
  }

  if (params.organizer) {
    if (params.organizer.startsWith(SOURCE_ORGANIZER_PREFIX)) {
      query = query.eq(
        "source_name",
        params.organizer.slice(SOURCE_ORGANIZER_PREFIX.length)
      );
    } else {
      query = query.eq("organizer_id", params.organizer);
    }
  }

  if (params.location) {
    const loc = params.location.split(",")[0].trim(); // use city portion
    query = query.or(`city.ilike.%${loc}%,address.ilike.%${loc}%`);
  }

  return query;
}
