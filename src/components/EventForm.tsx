"use client";

import { useState, useCallback } from "react";
import DateTimePicker from "./DateTimePicker";
import BannerUpload from "./BannerUpload";
import RecurrenceOptions from "./RecurrenceOptions";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Genre, EventType, FeaturedReader } from "@/types/database";
import { GENRES } from "@/lib/genres";
import { type RecurrenceRule, generateOccurrenceDates, generateNextOccurrence } from "@/lib/recurrence";

// Common time zones for the picker, grouped by region
export const TIME_ZONE_GROUPS: { region: string; zones: { value: string; label: string }[] }[] = [
  {
    region: "Americas",
    zones: [
      { value: "America/New_York", label: "Eastern (ET)" },
      { value: "America/Chicago", label: "Central (CT)" },
      { value: "America/Denver", label: "Mountain (MT)" },
      { value: "America/Phoenix", label: "Arizona (no DST)" },
      { value: "America/Los_Angeles", label: "Pacific (PT)" },
      { value: "America/Anchorage", label: "Alaska (AKT)" },
      { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
      { value: "America/Toronto", label: "Toronto" },
      { value: "America/Vancouver", label: "Vancouver" },
      { value: "America/Mexico_City", label: "Mexico City" },
      { value: "America/Bogota", label: "Bogotá" },
      { value: "America/Sao_Paulo", label: "São Paulo" },
      { value: "America/Buenos_Aires", label: "Buenos Aires" },
    ],
  },
  {
    region: "Europe",
    zones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Dublin", label: "Dublin" },
      { value: "Europe/Lisbon", label: "Lisbon" },
      { value: "Europe/Paris", label: "Paris" },
      { value: "Europe/Madrid", label: "Madrid" },
      { value: "Europe/Berlin", label: "Berlin" },
      { value: "Europe/Amsterdam", label: "Amsterdam" },
      { value: "Europe/Rome", label: "Rome" },
      { value: "Europe/Athens", label: "Athens" },
      { value: "Europe/Helsinki", label: "Helsinki" },
      { value: "Europe/Moscow", label: "Moscow" },
    ],
  },
  {
    region: "Africa & Middle East",
    zones: [
      { value: "Africa/Cairo", label: "Cairo" },
      { value: "Africa/Lagos", label: "Lagos" },
      { value: "Africa/Johannesburg", label: "Johannesburg" },
      { value: "Africa/Nairobi", label: "Nairobi" },
      { value: "Asia/Jerusalem", label: "Jerusalem" },
      { value: "Asia/Dubai", label: "Dubai" },
    ],
  },
  {
    region: "Asia",
    zones: [
      { value: "Asia/Istanbul", label: "Istanbul" },
      { value: "Asia/Kolkata", label: "Mumbai / Delhi (IST)" },
      { value: "Asia/Bangkok", label: "Bangkok" },
      { value: "Asia/Jakarta", label: "Jakarta" },
      { value: "Asia/Shanghai", label: "Shanghai / Beijing" },
      { value: "Asia/Hong_Kong", label: "Hong Kong" },
      { value: "Asia/Singapore", label: "Singapore" },
      { value: "Asia/Seoul", label: "Seoul" },
      { value: "Asia/Tokyo", label: "Tokyo" },
    ],
  },
  {
    region: "Oceania",
    zones: [
      { value: "Australia/Perth", label: "Perth" },
      { value: "Australia/Adelaide", label: "Adelaide" },
      { value: "Australia/Sydney", label: "Sydney / Melbourne" },
      { value: "Pacific/Auckland", label: "Auckland" },
    ],
  },
];

export const TIME_ZONES: { value: string; label: string }[] = TIME_ZONE_GROUPS.flatMap(
  (g) => g.zones
);

const DEFAULT_TIMEZONE =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "America/New_York";

// Offset (ms) to add to a UTC instant to get the wall-clock time in `timeZone`
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - date.getTime();
}

// Extract the wall-clock "YYYY-MM-DDTHH:MM" components from a Date object (browser-local interpretation)
function dateToWallClock(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert a "YYYY-MM-DDTHH:MM" wall-clock string in `timeZone` to a UTC ISO string
function zonedToUtcIso(local: string, timeZone: string): string {
  if (!local) return "";
  const naive = new Date(`${local}:00Z`); // treat the wall-clock as if it were UTC
  const offset = tzOffsetMs(naive, timeZone);
  return new Date(naive.getTime() - offset).toISOString();
}

// Convert a UTC ISO string to a "YYYY-MM-DDTHH:MM" wall-clock string in `timeZone`
function utcIsoToZoned(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

interface EventData {
  title: string;
  description: string | null;
  genre: Genre[];
  event_type: EventType;
  date_time: string;
  timezone?: string | null;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  address2?: string | null;
  city: string | null;
  zip_code?: string | null;
  state: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  virtual_url: string | null;
  open_mic: boolean;
  featured_readers: FeaturedReader[] | null;
  rsvp_enabled: boolean;
  banner_url?: string | null;
  ticket_url?: string | null;
  ticket_type?: string | null;
  recurrence_rule?: object | null;
  parent_event_id?: string | null;
  is_ongoing?: boolean;
  series_end_date?: string | null;
}

export type EditScope = "this" | "future" | "all";

interface SeriesContext {
  parentId: string;
  isParent: boolean;
  futureCount: number;
}

interface Props {
  organizerId: string;
  initialData?: EventData & { id?: string; is_published?: boolean };
  eventId?: string;
  seriesContext?: SeriesContext;
  /** Admin-only: expose "via [org]" source attribution fields */
  allowSourceAttribution?: boolean;
  /** Flag incomplete fields that triggered the "Needs details" tag */
  highlightMissingFields?: boolean;
}

// Strip suite/apt/unit suffixes before geocoding — Nominatim returns nothing
// for "123 Main St Suite 200". Covers addresses typed with the unit inline.
function streetForGeocode(address: string): string {
  return address
    .replace(/[,\s]+(suite|ste|apt|apartment|unit|bldg|building|fl|floor|rm|room|#)\.?\s*[\w-]+\s*$/i, "")
    .trim();
}

// Geocode an address using Nominatim (free, no API key)
interface GeocodeResult {
  lat: number;
  lng: number;
  label?: string;
  /** Pin is a zip/city centroid, not the exact address (OSM lacks the street) */
  approximate?: boolean;
}

async function geocode(
  address: string,
  expectedCity?: string
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const hit = data[0];
    if (!hit) return null;
    const addr = hit.address ?? {};
    const resolvedCity =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    // Reject results that contradict the typed city — a missing pin is a
    // visible problem, a wrong pin is a silent one. Containment check rather
    // than strict equality: internationally Nominatim often returns the
    // locality at a different granularity (e.g. AU suburbs vs. city), so
    // also accept a match against suburb/county before rejecting.
    const expected = expectedCity?.trim().toLowerCase() ?? "";
    if (expected && resolvedCity) {
      const candidates = [resolvedCity, addr.suburb, addr.county]
        .filter(Boolean)
        .map((c: string) => c.toLowerCase());
      const matches = candidates.some(
        (c: string) => c.includes(expected) || expected.includes(c)
      );
      if (!matches) return null;
    }
    const resolvedState = addr.state ?? addr.province ?? "";
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      label: [resolvedCity, resolvedState].filter(Boolean).join(", ") || undefined,
    };
  } catch {
    // geocoding is best-effort
  }
  return null;
}

// Resolve zip code → state + country via Nominatim
async function resolveZip(
  zip: string,
  city?: string
): Promise<{ state: string; country: string } | null> {
  try {
    // Include the city (when known) in a free-text query so Nominatim can
    // disambiguate postal codes that collide across countries (e.g. a US zip
    // that also matches a postal code in South Korea or elsewhere).
    const params = city
      ? `q=${encodeURIComponent(`${city} ${zip}`)}`
      : `postalcode=${encodeURIComponent(zip)}`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&${params}`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data[0]?.address) {
      const addr = data[0].address;
      const state = addr.state ?? addr.province ?? addr.region ?? "";
      const country = addr.country ?? "";
      return { state, country };
    }
  } catch {
    // best-effort
  }
  return null;
}

export default function EventForm({ organizerId, initialData, eventId, seriesContext, allowSourceAttribution, highlightMissingFields }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!eventId;

  const [timezone, setTimezone] = useState<string>(
    initialData?.timezone ?? DEFAULT_TIMEZONE
  );

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    event_type: initialData?.event_type ?? ("in_person" as EventType),
    date_time: initialData?.date_time
      ? utcIsoToZoned(initialData.date_time, initialData?.timezone ?? DEFAULT_TIMEZONE)
      : "",
    end_time: initialData?.end_time
      ? utcIsoToZoned(initialData.end_time, initialData?.timezone ?? DEFAULT_TIMEZONE)
      : "",
    location_name: initialData?.location_name ?? "",
    address: initialData?.address ?? "",
    address2: initialData?.address2 ?? "",
    city: initialData?.city ?? "",
    zip_code: initialData?.zip_code ?? "",
    state: initialData?.state ?? "",
    country: initialData?.country ?? "",
    virtual_url: initialData?.virtual_url ?? "",
    open_mic: initialData?.open_mic ?? false,
    rsvp_enabled: initialData?.rsvp_enabled ?? false,
    ticket_url: initialData?.ticket_url ?? "",
    ticket_type: (initialData as { ticket_type?: string })?.ticket_type ?? "",
    source_name: (initialData as { source_name?: string | null })?.source_name ?? "",
    source_url: (initialData as { source_url?: string | null })?.source_url ?? "",
  });

  const [genres, setGenres] = useState<Genre[]>(
    initialData?.genre ?? []
  );

  const [bannerUrl, setBannerUrl] = useState<string | null>(
    initialData?.banner_url ?? null
  );

  const [readers, setReaders] = useState<FeaturedReader[]>(
    initialData?.featured_readers ?? []
  );

  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState<GeocodeResult | null>(
    initialData?.lat != null && initialData?.lng != null
      ? { lat: initialData.lat, lng: initialData.lng }
      : null
  );

  // Parent of an existing series: start from its saved rule so the schedule
  // is visible and editable
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(
    initialData?.recurrence_rule && !initialData?.parent_event_id
      ? (initialData.recurrence_rule as RecurrenceRule)
      : null
  );
  const initialRuleJson = JSON.stringify(initialData?.recurrence_rule ?? null);
  const [newEventOngoing, setNewEventOngoing] = useState(false);
  const [editScope, setEditScope] = useState<EditScope>("this");

  // Series settings (only relevant when editing the parent recurring event)
  const isParentEvent = !!(initialData?.recurrence_rule) && !initialData?.parent_event_id;
  // A non-series event (e.g. an import) can be converted into a recurring
  // series while editing — it becomes the series parent
  const isStandaloneEdit =
    isEditing && !initialData?.recurrence_rule && !initialData?.parent_event_id;
  const [seriesOngoing, setSeriesOngoing] = useState<boolean>(initialData?.is_ongoing ?? false);
  const [seriesEndDate, setSeriesEndDate] = useState<string>(initialData?.series_end_date ?? "");

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isDraft = isEditing && initialData?.is_published === false;
  const [publishIntent, setPublishIntent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Geocode when address, city, or state loses focus. Include the city/state/
  // country so a bare street address can't match the same street in another
  // city (e.g. "124 E. Washington St." alone resolves to Milwaukee, not Ann Arbor).
  // Full address first; if OSM doesn't have the street, fall back to the zip
  // centroid, then the city — an approximately-right pin beats no pin
  async function geocodeBestEffort(): Promise<GeocodeResult | null> {
    // Postal code included — international addresses (e.g. AU "QLD 4819")
    // often don't resolve without it
    const full = [streetForGeocode(form.address), form.city, form.state, form.zip_code, form.country]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(", ");
    const exact = await geocode(full, form.city);
    if (exact) return exact;

    if (form.zip_code.trim()) {
      const byZip = await geocode(
        [form.city, form.zip_code, form.country].map((p) => p.trim()).filter(Boolean).join(", "),
        form.city
      );
      if (byZip) return { ...byZip, approximate: true };
    }

    if (form.city.trim()) {
      const byCity = await geocode(
        [form.city, form.state, form.country].map((p) => p.trim()).filter(Boolean).join(", "),
        form.city
      );
      if (byCity) return { ...byCity, approximate: true };
    }

    return null;
  }

  const handleAddressBlur = useCallback(async () => {
    if (!form.address.trim() || form.event_type !== "in_person") return;
    // When editing, never re-geocode an unchanged address — a tab through the
    // field must not be able to move an existing pin
    const locationUnchanged =
      isEditing &&
      geocoded !== null &&
      form.address.trim() === (initialData?.address ?? "") &&
      form.city.trim() === (initialData?.city ?? "") &&
      form.zip_code.trim() === (initialData?.zip_code ?? "") &&
      form.state.trim() === (initialData?.state ?? "") &&
      form.country.trim() === (initialData?.country ?? "");
    if (locationUnchanged) return;
    setGeocoding(true);
    const result = await geocodeBestEffort();
    setGeocoded(result);
    setGeocoding(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city, form.state, form.zip_code, form.country, form.event_type, isEditing, geocoded, initialData]);

  // Featured readers helpers
  function addReader() {
    setReaders((prev) => [...prev, { name: "", url: "", bio: "" }]);
  }

  function updateReader(
    index: number,
    field: keyof FeaturedReader,
    value: string
  ) {
    setReaders((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function removeReader(index: number) {
    setReaders((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCancel() {
    if (!eventId) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to cancel event.");
        setCancelling(false);
        setCancelConfirm(false);
        return;
      }
      window.location.href = "/dashboard";
    } catch {
      setError("Network error. Please try again.");
      setCancelling(false);
      setCancelConfirm(false);
    }
  }

  function toggleGenre(genre: Genre) {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Title is required.";
    if (genres.length === 0) return "Select at least one genre.";
    if (!form.date_time) return "Date and time are required.";
    if (form.event_type === "in_person" && !form.location_name.trim())
      return "Location name is required for in-person events.";
    if (form.event_type === "virtual" && !form.virtual_url.trim())
      return "A link is required for virtual events.";
    if (form.virtual_url.trim() && !/^https?:\/\//i.test(form.virtual_url.trim()))
      return "Virtual event link must start with http:// or https://";
    if (form.ticket_type && form.ticket_type !== "none" && !form.ticket_url.trim())
      return "A ticket URL is required when a ticket type is selected.";
    if (form.ticket_url.trim() && !/^https?:\/\//i.test(form.ticket_url.trim()))
      return "Ticket URL must start with http:// or https://";
    if (form.source_url.trim() && !/^https?:\/\//i.test(form.source_url.trim()))
      return "Source URL must start with http:// or https://";
    if (form.source_url.trim() && !form.source_name.trim())
      return "A source name is required when a source URL is set.";
    if (form.end_time && form.date_time && form.end_time <= form.date_time)
      return "End time must be after the start time.";
    // Convert using the selected timezone so this check is correct regardless of browser locale
    const eventDate = form.date_time ? new Date(zonedToUtcIso(form.date_time, timezone)) : null;
    if (eventDate && eventDate < new Date() && !isEditing)
      return "Event date is in the past. Please check the date and time.";
    for (const r of readers) {
      if (!r.name.trim()) return "All featured readers need a name.";
      const wordCount = (r.bio ?? "").trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 75) return `Bio for ${r.name} exceeds 75 words (${wordCount} words).`;
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    // Attempt geocode on submit if not already done
    let coords = geocoded;
    if (form.event_type === "in_person" && !coords && form.address.trim()) {
      coords = await geocodeBestEffort();
    }

    const sharedFields = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      genre: genres,
      event_type: form.event_type,
      date_time: zonedToUtcIso(form.date_time, timezone),
      timezone,
      end_time: form.end_time ? zonedToUtcIso(form.end_time, timezone) : null,
      location_name:
        form.event_type === "in_person"
          ? form.location_name.trim() || null
          : null,
      address:
        form.event_type === "in_person" ? form.address.trim() || null : null,
      address2:
        form.event_type === "in_person" ? form.address2.trim() || null : null,
      city: form.event_type === "in_person" ? form.city.trim() || null : null,
      zip_code: form.event_type === "in_person" ? form.zip_code.trim() || null : null,
      state: form.event_type === "in_person" ? form.state.trim() || null : null,
      country: form.event_type === "in_person" ? form.country.trim() || null : null,
      lat: form.event_type === "in_person" ? coords?.lat ?? null : null,
      lng: form.event_type === "in_person" ? coords?.lng ?? null : null,
      virtual_url: form.virtual_url.trim() || null,
      open_mic: genres.includes("open_mic"),
      featured_readers: readers.filter((r) => r.name.trim()).length
        ? readers.filter((r) => r.name.trim())
        : null,
      rsvp_enabled: form.rsvp_enabled,
      ticket_url: form.ticket_url.trim() || null,
      ticket_type: (form.ticket_type === "none" ? "none" : form.ticket_type || null) as "paid" | "free" | "none" | null,
      banner_url: bannerUrl,
      // Only the admin form includes these keys — regular org edits leave any
      // existing attribution untouched
      ...(allowSourceAttribution
        ? {
            source_name: form.source_name.trim() || null,
            source_url: form.source_url.trim() || null,
            is_imported: !!form.source_name.trim(),
          }
        : {}),
    };

    // Future occurrences for a recurring series (parent = first occurrence).
    // Ongoing series seed 9 children (10 total incl. parent); fixed series
    // generate every occurrence up front.
    function buildChildOccurrences(parentId: string) {
      if (!recurrenceRule || !form.date_time) return [];
      // Parse in browser-local time for recurrence math (wall-clock values are correct)
      const startDate = new Date(form.date_time);
      const durationMs = form.end_time
        ? new Date(form.end_time).getTime() - startDate.getTime()
        : null;

      const dates: Date[] = [];
      const ongoingFlag = isParentEvent ? seriesOngoing : newEventOngoing;
      if (ongoingFlag) {
        let cursor = startDate;
        for (let i = 0; i < 9; i++) {
          const next = generateNextOccurrence(cursor, recurrenceRule);
          if (!next) break;
          dates.push(next);
          cursor = next;
        }
      } else {
        dates.push(...generateOccurrenceDates(startDate, recurrenceRule));
      }

      // Convert wall-clock dates → correct UTC using the event's timezone, not browser locale
      return dates.map((d) => {
        const utcMs = new Date(zonedToUtcIso(dateToWallClock(d), timezone)).getTime();
        return {
          organizer_id: organizerId,
          parent_event_id: parentId,
          ...sharedFields,
          recurrence_rule: null,
          is_ongoing: false,
          date_time: new Date(utcMs).toISOString(),
          end_time: durationMs !== null ? new Date(utcMs + durationMs).toISOString() : null,
        };
      });
    }

    if (isEditing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("events")
        .update({ ...sharedFields, ...(isDraft ? { is_published: publishIntent } : {}) })
        .eq("id", eventId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Propagate non-date fields to series siblings if needed
      if (seriesContext && editScope !== "this") {
        const nonDateFields = {
          title: sharedFields.title,
          description: sharedFields.description,
          genre: sharedFields.genre,
          event_type: sharedFields.event_type,
          timezone: sharedFields.timezone,
          location_name: sharedFields.location_name,
          address: sharedFields.address,
          address2: sharedFields.address2,
          city: sharedFields.city,
          zip_code: sharedFields.zip_code,
          state: sharedFields.state,
          country: sharedFields.country,
          lat: sharedFields.lat,
          lng: sharedFields.lng,
          virtual_url: sharedFields.virtual_url,
          open_mic: sharedFields.open_mic,
          featured_readers: sharedFields.featured_readers,
          rsvp_enabled: sharedFields.rsvp_enabled,
          ticket_url: sharedFields.ticket_url,
          banner_url: sharedFields.banner_url,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let siblingsQuery = (supabase as any)
          .from("events")
          .update(nonDateFields)
          .eq("parent_event_id", seriesContext.parentId)
          .neq("id", eventId!);

        if (editScope === "future") {
          siblingsQuery = siblingsQuery.gte("date_time", sharedFields.date_time);
        }

        const { error: siblingsError } = await siblingsQuery;
        if (siblingsError) {
          setError(`Event saved but series update failed: ${siblingsError.message}`);
          setLoading(false);
          return;
        }
      }

      // If editing the parent event, also persist series settings
      if (isParentEvent && eventId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: seriesSettingsError } = await (supabase as any)
          .from("events")
          .update({
            is_ongoing: seriesOngoing,
            series_end_date: seriesEndDate || null,
            ...(recurrenceRule ? { recurrence_rule: recurrenceRule } : {}),
          })
          .eq("id", eventId);
        if (seriesSettingsError) {
          setError(`Event saved but series settings failed to update: ${seriesSettingsError.message}`);
          setLoading(false);
          return;
        }

        // Schedule changed: regenerate future occurrences under the new rule.
        // Occurrences with RSVPs are kept (attendees were emailed confirmations);
        // the organizer can cancel those individually, which notifies attendees.
        const ruleChanged = recurrenceRule && JSON.stringify(recurrenceRule) !== initialRuleJson;
        if (ruleChanged) {
          const nowIso = new Date().toISOString();

          const { data: futureChildren } = await supabase
            .from("events")
            .select("id, date_time, is_cancelled")
            .eq("parent_event_id", eventId)
            .gte("date_time", nowIso);

          const childIds = (futureChildren ?? []).map((c) => c.id);
          const keepIds = new Set<string>();
          if (childIds.length > 0) {
            const { data: rsvpRows } = await supabase
              .from("rsvps")
              .select("event_id")
              .in("event_id", childIds);
            (rsvpRows ?? []).forEach((r) => keepIds.add(r.event_id));
          }
          // Cancelled occurrences also stay — they document the cancellation
          const deleteIds = (futureChildren ?? [])
            .filter((c) => !keepIds.has(c.id) && !c.is_cancelled)
            .map((c) => c.id);

          if (deleteIds.length > 0) {
            const { error: deleteError } = await supabase
              .from("events")
              .delete()
              .in("id", deleteIds);
            if (deleteError) {
              setError(`Series settings saved but old occurrences couldn't be replaced: ${deleteError.message}`);
              setLoading(false);
              return;
            }
          }

          // Re-seed under the new rule, skipping dates already covered by a
          // kept (RSVP'd or cancelled) occurrence
          const keptTimes = new Set(
            (futureChildren ?? [])
              .filter((c) => keepIds.has(c.id) || c.is_cancelled)
              .map((c) => new Date(c.date_time).getTime())
          );
          const children = buildChildOccurrences(eventId).filter(
            (c) => c.date_time > nowIso && !keptTimes.has(new Date(c.date_time).getTime())
          );
          if (children.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: reseedError } = await (supabase as any).from("events").insert(children);
            if (reseedError) {
              setError(`Series schedule saved but new occurrences failed: ${reseedError.message}`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Convert a standalone event into a recurring series: this event becomes
      // the parent, future occurrences are seeded as children
      if (isStandaloneEdit && recurrenceRule && eventId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: convertError } = await (supabase as any)
          .from("events")
          .update({
            recurrence_rule: recurrenceRule,
            is_ongoing: newEventOngoing,
          })
          .eq("id", eventId);

        if (convertError) {
          setError(`Event saved but couldn't start the series: ${convertError.message}`);
          setLoading(false);
          return;
        }

        const children = buildChildOccurrences(eventId);
        if (children.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: childError } = await (supabase as any).from("events").insert(children);
          if (childError) {
            setError(`Series started but some occurrences failed: ${childError.message}`);
            setLoading(false);
            return;
          }
        }
      }

      router.push(`/events/${eventId}`);
    } else {
      // Insert parent event (first occurrence)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: insertError } = await (supabase as any)
        .from("events")
        .insert({
          organizer_id: organizerId,
          ...sharedFields,
          recurrence_rule: recurrenceRule ?? null,
          is_ongoing: recurrenceRule ? newEventOngoing : false,
          is_published: publishIntent,
        })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // Seed future occurrences as children of the new parent
      const children = buildChildOccurrences(data.id);
      if (children.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: childError } = await (supabase as any).from("events").insert(children);
        if (childError) {
          setError(`Event created but some occurrences failed: ${childError.message}`);
          setLoading(false);
          router.push(`/events/${data.id}`);
          return;
        }
      }

      // Drafts go to dashboard; published events go to the event detail page
      if (publishIntent) {
        router.push(`/events/${data.id}`);
      } else {
        router.push("/dashboard");
      }
    }
  }

  const inputClass =
    "w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange";

  const labelClass = "block text-cream-muted text-xs uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Title */}
      <div>
        <label className={labelClass}>Event title *</label>
        <input
          type="text"
          placeholder="e.g. Friday Night Readings at The Strand"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
          className={inputClass}
        />
      </div>

      {/* Banner */}
      <BannerUpload value={bannerUrl} onChange={setBannerUrl} />

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          placeholder="Tell readers what to expect…"
          rows={12}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Genre */}
      <div>
        <label className={labelClass}>
          Genre * <span className="normal-case tracking-normal text-cream-muted/60">— select all that apply</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {GENRES.map((g) => {
            const active = genres.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGenre(g.value)}
                className={`px-4 py-1.5 rounded-full text-sm border transition ${
                  active
                    ? "bg-orange border-orange text-cream"
                    : "border-cream/20 text-cream-muted hover:border-cream hover:text-cream"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {genres.length === 0 && (
          <p className="text-cream-muted/60 text-xs mt-1">Select at least one.</p>
        )}
      </div>

      {/* Event type */}
      <div>
        <label className={labelClass}>Event type *</label>
        <div className="flex gap-3">
          {(["in_person", "virtual"] as EventType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("event_type", t)}
              className={`flex-1 py-2.5 rounded-full border text-sm font-medium transition ${
                form.event_type === t
                  ? "bg-orange border-orange text-cream"
                  : "border-cream/20 text-cream-muted hover:border-cream hover:text-cream"
              }`}
            >
              {t === "in_person" ? "In Person" : "Virtual"}
            </button>
          ))}
        </div>
      </div>

      {/* Date & time */}
      <div className="space-y-4">
        <DateTimePicker
          label="Start date & time"
          value={form.date_time}
          onChange={(v) => set("date_time", v)}
          required
        />
        <DateTimePicker
          label="End time (optional)"
          value={form.end_time}
          onChange={(v) => set("end_time", v)}
        />
        <div>
          <label className="block text-cream-muted text-xs uppercase tracking-wider mb-1.5">
            Time zone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-orange w-full sm:w-64"
          >
            {!TIME_ZONES.some((z) => z.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {TIME_ZONE_GROUPS.map((group) => (
              <optgroup key={group.region} label={group.region}>
                {group.zones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label} — {z.value.replace("_", " ")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-cream-muted text-xs mt-1.5">
            The date and time above are in this time zone.
          </p>
        </div>
      </div>

      {/* Recurrence — new events, or converting a standalone event into a series */}
      {(!isEditing || isStandaloneEdit) && (
        <div>
          <label className={labelClass}>
            {isStandaloneEdit ? "Make recurring" : "Recurrence"}
          </label>
          {isStandaloneEdit && (
            <p className="text-cream-muted/60 text-xs mb-2 -mt-1">
              Pick a schedule to turn this event into a recurring series — this
              date becomes the first occurrence.
            </p>
          )}
          <RecurrenceOptions
            startDateIso={form.date_time}
            value={recurrenceRule}
            onChange={setRecurrenceRule}
            ongoing={newEventOngoing}
            onOngoingChange={setNewEventOngoing}
          />
        </div>
      )}

      {/* Location (in-person) */}
      {form.event_type === "in_person" && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Venue name *</label>
            <input
              type="text"
              placeholder="e.g. The Strand Bookstore"
              value={form.location_name}
              onChange={(e) => set("location_name", e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City *</label>
              <input
                type="text"
                placeholder="e.g. Durham"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={handleAddressBlur}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Zip / Postal code</label>
              <input
                type="text"
                placeholder="e.g. 27701"
                value={form.zip_code}
                onChange={(e) => set("zip_code", e.target.value)}
                onBlur={async (e) => {
                  const zip = e.target.value.trim();
                  if (!zip) return;
                  const result = await resolveZip(zip, form.city.trim() || undefined);
                  if (result) {
                    if (result.state) set("state", result.state);
                    if (result.country) set("country", result.country);
                  }
                }}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>State / Province</label>
              <input
                type="text"
                placeholder="e.g. NC"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                onBlur={handleAddressBlur}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                placeholder="e.g. United States"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className={inputClass}
              />
              <p className="text-cream-muted text-xs mt-1">
                Auto-filled from the zip code — please confirm it&apos;s correct.
              </p>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Address{" "}
              <span className="text-cream-muted/60 normal-case tracking-normal">
                — used to place a pin on the map
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 828 Broadway, New York, NY 10003"
                value={form.address}
                onChange={(e) => {
                  set("address", e.target.value);
                  setGeocoded(null);
                }}
                onBlur={handleAddressBlur}
                className={inputClass}
              />
              {geocoding && (
                <span className="absolute right-3 top-3 text-cream-muted text-xs">
                  Locating…
                </span>
              )}
              {geocoded && !geocoding && (
                <span className="absolute right-3 top-3 text-orange text-xs">
                  ✓ Located{geocoded.label ? `: ${geocoded.label}` : ""}
                  {geocoded.approximate ? " (approximate)" : ""}
                </span>
              )}
            </div>
            {geocoded === null && form.address.trim() && !geocoding && (
              <p className="text-cream-muted/60 text-xs mt-1">
                Leave the address field and we'll try to locate it. The event
                will still be saved if it can't be found.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Suite / Apt / Unit (optional)</label>
            <input
              type="text"
              placeholder="e.g. Suite 200"
              value={form.address2}
              onChange={(e) => set("address2", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* Virtual URL */}
      {((needsVirtualUrl) => (
        <div className={needsVirtualUrl ? "rounded-xl border border-orange/60 p-3 -mx-3" : ""}>
          {needsVirtualUrl && (
            <p className="text-orange text-xs mb-2">Add an event link to remove the &quot;Needs details&quot; flag.</p>
          )}
          <label className={labelClass}>
            {form.event_type === "virtual" ? "Event link *" : "Event link (optional)"}
          </label>
          <input
            type="url"
            placeholder={
              form.event_type === "virtual"
                ? "https://zoom.us/j/… or similar"
                : "Optional — link to event page, Eventbrite listing, livestream, etc."
            }
            value={form.virtual_url}
            onChange={(e) => set("virtual_url", e.target.value)}
            className={inputClass}
          />
        </div>
      ))(highlightMissingFields && form.event_type !== "in_person" && !form.virtual_url.trim())}

      {/* Toggles + ticket link */}
      <div className="space-y-4">
        <label className="flex items-center gap-4 cursor-pointer">
          <Toggle
            value={form.rsvp_enabled}
            onChange={(v) => set("rsvp_enabled", v)}
          />
          <div>
            <span className="text-cream text-sm font-medium">Enable RSVPs</span>
            <p className="text-cream-muted text-xs">
              Free attendance tracked through litly.
            </p>
          </div>
        </label>

        {/* External ticketing */}
        {((needsTicket) => (
          <div className={needsTicket ? "rounded-xl border border-orange/60 p-3 -mx-3 space-y-3" : "space-y-3"}>
            {needsTicket && (
              <p className="text-orange text-xs">Add a ticket or registration link to remove the &quot;Needs details&quot; flag.</p>
            )}
            <label className={labelClass}>External ticketing</label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { value: "none", label: "No tickets" },
                  { value: "free", label: "Free ticket / registration" },
                  { value: "paid", label: "Paid ticket" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    set("ticket_type", opt.value);
                    if (!opt.value) set("ticket_url", "");
                  }}
                  className={`px-4 py-1.5 rounded-full text-sm border transition ${
                    form.ticket_type === opt.value
                      ? "bg-orange border-orange text-cream"
                      : "border-cream/20 text-cream-muted hover:border-cream hover:text-cream"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {form.ticket_type && form.ticket_type !== "none" && (
              <div>
                <input
                  type="url"
                  placeholder={form.ticket_type === "paid" ? "https://eventbrite.com/… or ticketing page" : "https://… registration or RSVP page"}
                  value={form.ticket_url}
                  onChange={(e) => set("ticket_url", e.target.value)}
                  className={inputClass}
                />
                <p className="text-cream-muted/60 text-xs mt-1">
                  {form.ticket_type === "paid"
                    ? "Users will be directed here to purchase a ticket — litly does not handle payments."
                    : "Users will be directed here to register or claim a free ticket."}
                </p>
              </div>
            )}
          </div>
        ))(highlightMissingFields && form.event_type === "in_person" && !form.ticket_url.trim() && form.ticket_type !== "none")}
      </div>

      {/* Source attribution — admin only */}
      {allowSourceAttribution && (
        <div className="border border-orange/30 rounded-2xl p-5 space-y-4">
          <div>
            <label className={labelClass}>Source attribution (admin)</label>
            <p className="text-cream-muted/60 text-xs -mt-1 mb-3">
              Credit the org that originally posted this event. Shows as
              &ldquo;via [name]&rdquo; on cards and adds the claim link on the
              event page. Leave blank for litly&apos;s own events.
            </p>
            <input
              type="text"
              placeholder="Original org or publication name"
              value={form.source_name}
              onChange={(e) => set("source_name", e.target.value)}
              className={inputClass}
            />
          </div>
          <input
            type="url"
            placeholder="https://… link to the original listing (optional)"
            value={form.source_url}
            onChange={(e) => set("source_url", e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {/* Featured readers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={labelClass + " mb-0"}>Featured readers</label>
          <button
            type="button"
            onClick={addReader}
            className="text-orange text-sm hover:text-orange/80 transition"
          >
            + Add reader
          </button>
        </div>

        {readers.length === 0 && (
          <p className="text-cream-muted/60 text-sm">
            No featured readers yet. Add a name and a link to their site or
            social media.
          </p>
        )}

        <div className="space-y-4">
          {readers.map((reader, i) => {
            const wordCount = (reader.bio ?? "").trim().split(/\s+/).filter(Boolean).length;
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Name"
                      value={reader.name}
                      onChange={(e) => updateReader(i, "name", e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="url"
                      placeholder="https://…"
                      value={reader.url}
                      onChange={(e) => updateReader(i, "url", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <textarea
                      placeholder="Short bio (optional, 75 words max)"
                      value={reader.bio ?? ""}
                      onChange={(e) => updateReader(i, "bio", e.target.value)}
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                    <p className={`text-xs mt-0.5 text-right ${wordCount > 75 ? "text-orange" : "text-cream-muted/50"}`}>
                      {wordCount}/75 words
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeReader(i)}
                  className="mt-3 text-cream-muted hover:text-cream transition text-lg leading-none"
                  aria-label="Remove reader"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Series settings — only shown when editing the parent (first) event of a recurring series */}
      {isEditing && isParentEvent && (
        <div className="bg-navy border border-cream/10 rounded-2xl p-5 space-y-4">
          <p className="text-cream-muted text-xs uppercase tracking-wider">Series settings</p>

          <RecurrenceOptions
            startDateIso={form.date_time}
            value={recurrenceRule}
            onChange={setRecurrenceRule}
            ongoing={seriesOngoing}
            onOngoingChange={setSeriesOngoing}
            alwaysOn
          />
          <p className="text-cream-muted/60 text-xs">
            Changing the schedule replaces upcoming occurrences with the new
            dates. Occurrences that already have RSVPs (and cancelled ones)
            are kept — cancel those individually to notify attendees.
          </p>

          <div>
            <label className={labelClass}>Series end date (optional)</label>
            <input
              type="date"
              value={seriesEndDate}
              onChange={(e) => setSeriesEndDate(e.target.value)}
              className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange [color-scheme:dark]"
            />
            <p className="text-cream-muted/60 text-xs mt-1">
              No new occurrences will be generated after this date.
            </p>
          </div>
        </div>
      )}

      {/* Series scope picker — only shown when editing a recurring event */}
      {isEditing && seriesContext && (
        <div className="bg-navy border border-cream/10 rounded-2xl p-5">
          <p className="text-cream-muted text-xs uppercase tracking-wider mb-3">Apply changes to</p>
          <div className="flex flex-col gap-2">
            {(
              [
                { scope: "this" as EditScope, label: "Just this occurrence" },
                { scope: "future" as EditScope, label: `This and future occurrences${seriesContext.futureCount > 0 ? ` (${seriesContext.futureCount} upcoming)` : ""}` },
                { scope: "all" as EditScope, label: "All occurrences in the series" },
              ] as const
            ).map(({ scope, label }) => (
              <label key={scope} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="editScope"
                  value={scope}
                  checked={editScope === scope}
                  onChange={() => setEditScope(scope)}
                  className="accent-orange"
                />
                <span className="text-cream text-sm">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-cream-muted/60 text-xs mt-3">
            Date and time for each occurrence will not change — only the event details.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-orange text-sm bg-orange/10 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Cancel this event — only when editing */}
      {isEditing && (
        <div className="pt-2 border-t border-cream/10">
          {!cancelConfirm ? (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="w-full py-3 rounded-full border border-orange/40 text-orange text-sm font-medium hover:bg-orange/10 transition"
            >
              Cancel this event
            </button>
          ) : (
            <div className="bg-orange/10 border border-orange/30 rounded-2xl p-5 space-y-3">
              <p className="text-cream text-sm font-medium">Cancel this event?</p>
              <p className="text-cream-muted text-xs">
                This cannot be undone. All RSVPd patrons will receive a cancellation email.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
                >
                  {cancelling ? "Cancelling…" : "Yes, cancel event"}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelConfirm(false)}
                  className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm"
                >
                  Keep event
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        {isEditing && !isDraft ? (
          // Live event being edited — single "Save changes" button
          <button
            type="submit"
            disabled={loading}
            onClick={() => setPublishIntent(true)}
            className="flex-1 bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        ) : (
          // New event or draft — two buttons: Post event (primary) + Save draft
          <>
            <button
              type="submit"
              disabled={loading}
              onClick={() => setPublishIntent(true)}
              className="flex-1 bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {loading && publishIntent ? "Posting…" : "Post event"}
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={() => setPublishIntent(false)}
              className="px-6 py-3 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition"
            >
              {loading && !publishIntent ? "Saving…" : "Save draft"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition"
        >
          Go back
        </button>
      </div>
    </form>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full border transition relative shrink-0 ${
        value ? "bg-orange border-orange" : "bg-navy-light border-cream/30"
      }`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
          value ? "left-5" : "left-0.5"
        }`}
      />
    </button>
  );
}
