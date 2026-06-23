import type { Genre, EventType } from "@/types/database";

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
    // Overlap operator: events whose genre array contains any selected genre
    query = query.overlaps("genre", genres as Genre[]);
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
    query = query.eq("organizer_id", params.organizer);
  }

  if (params.location) {
    const loc = params.location.split(",")[0].trim(); // use city portion
    query = query.or(`city.ilike.%${loc}%,address.ilike.%${loc}%`);
  }

  return query;
}
