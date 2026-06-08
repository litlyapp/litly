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

interface EventData {
  title: string;
  description: string | null;
  genre: Genre[];
  event_type: EventType;
  date_time: string;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
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
  initialData?: EventData & { id?: string };
  eventId?: string;
  seriesContext?: SeriesContext;
}

// Geocode an address using Nominatim (free, no API key)
async function geocode(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // geocoding is best-effort
  }
  return null;
}

// Resolve zip code → state + country via Nominatim
async function resolveZip(
  zip: string
): Promise<{ state: string; country: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(zip)}&addressdetails=1`,
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

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  // Convert UTC ISO to local time "YYYY-MM-DDTHH:MM" for the picker
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ organizerId, initialData, eventId, seriesContext }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!eventId;

  const [form, setForm] = useState({
    title: initialData?.title ?? "",
    description: initialData?.description ?? "",
    event_type: initialData?.event_type ?? ("in_person" as EventType),
    date_time: toDatetimeLocal(initialData?.date_time),
    end_time: toDatetimeLocal(initialData?.end_time),
    location_name: initialData?.location_name ?? "",
    address: initialData?.address ?? "",
    city: initialData?.city ?? "",
    zip_code: "",
    state: initialData?.state ?? "",
    country: initialData?.country ?? "",
    virtual_url: initialData?.virtual_url ?? "",
    open_mic: initialData?.open_mic ?? false,
    rsvp_enabled: initialData?.rsvp_enabled ?? false,
    ticket_url: initialData?.ticket_url ?? "",
    ticket_type: (initialData as { ticket_type?: string })?.ticket_type ?? "",
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
  const [geocoded, setGeocoded] = useState<{ lat: number; lng: number } | null>(
    initialData?.lat != null && initialData?.lng != null
      ? { lat: initialData.lat, lng: initialData.lng }
      : null
  );

  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null);
  const [newEventOngoing, setNewEventOngoing] = useState(false);
  const [editScope, setEditScope] = useState<EditScope>("this");

  // Series settings (only relevant when editing the parent recurring event)
  const isParentEvent = !!(initialData?.recurrence_rule) && !initialData?.parent_event_id;
  const [seriesOngoing, setSeriesOngoing] = useState<boolean>(initialData?.is_ongoing ?? false);
  const [seriesEndDate, setSeriesEndDate] = useState<string>(initialData?.series_end_date ?? "");

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Geocode address when it loses focus
  const handleAddressBlur = useCallback(async () => {
    if (!form.address.trim() || form.event_type !== "in_person") return;
    setGeocoding(true);
    const result = await geocode(form.address);
    setGeocoded(result);
    setGeocoding(false);
  }, [form.address, form.event_type]);

  // Featured readers helpers
  function addReader() {
    setReaders((prev) => [...prev, { name: "", url: "" }]);
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
      router.push("/dashboard");
      router.refresh();
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
    for (const r of readers) {
      if (!r.name.trim()) return "All featured readers need a name.";
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
      coords = await geocode(form.address);
    }

    const sharedFields = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      genre: genres,
      event_type: form.event_type,
      date_time: new Date(form.date_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      location_name:
        form.event_type === "in_person"
          ? form.location_name.trim() || null
          : null,
      address:
        form.event_type === "in_person" ? form.address.trim() || null : null,
      city: form.event_type === "in_person" ? form.city.trim() || null : null,
      state: form.event_type === "in_person" ? form.state.trim() || null : null,
      country: form.event_type === "in_person" ? form.country.trim() || null : null,
      lat: form.event_type === "in_person" ? coords?.lat ?? null : null,
      lng: form.event_type === "in_person" ? coords?.lng ?? null : null,
      virtual_url:
        form.event_type === "virtual" ? form.virtual_url.trim() || null : null,
      open_mic: genres.includes("open_mic"),
      featured_readers: readers.filter((r) => r.name.trim()).length
        ? readers.filter((r) => r.name.trim())
        : null,
      rsvp_enabled: form.rsvp_enabled,
      ticket_url: form.ticket_url.trim() || null,
      ticket_type: (form.ticket_type || null) as "paid" | "free" | null,
      banner_url: bannerUrl,
    };

    if (isEditing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("events")
        .update(sharedFields)
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
          location_name: sharedFields.location_name,
          address: sharedFields.address,
          city: sharedFields.city,
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

        await siblingsQuery;
      }

      // If editing the parent event, also persist series settings
      if (isParentEvent && eventId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("events")
          .update({
            is_ongoing: seriesOngoing,
            series_end_date: seriesEndDate || null,
          })
          .eq("id", eventId);
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
        })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
      }

      // For ongoing events: seed first 9 children immediately (parent = occurrence 1, total = 10)
      if (recurrenceRule && form.date_time && newEventOngoing) {
        const startDate = new Date(form.date_time);
        const durationMs = form.end_time
          ? new Date(form.end_time).getTime() - startDate.getTime()
          : null;

        const children = [];
        let cursor = startDate;
        for (let i = 0; i < 9; i++) {
          const next = generateNextOccurrence(cursor, recurrenceRule);
          if (!next) break;
          children.push({
            organizer_id: organizerId,
            parent_event_id: data.id,
            ...sharedFields,
            recurrence_rule: null,
            is_ongoing: false,
            date_time: next.toISOString(),
            end_time: durationMs !== null ? new Date(next.getTime() + durationMs).toISOString() : null,
          });
          cursor = next;
        }

        if (children.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("events").insert(children);
        }
      }

      // Generate and insert child occurrences (skipped for ongoing — seeded above)
      if (recurrenceRule && form.date_time && !newEventOngoing) {
        const startDate = new Date(form.date_time);
        const occurrenceDates = generateOccurrenceDates(startDate, recurrenceRule);

        const durationMs =
          form.end_time
            ? new Date(form.end_time).getTime() - startDate.getTime()
            : null;

        const children = occurrenceDates.map((d) => ({
          organizer_id: organizerId,
          parent_event_id: data.id,
          ...sharedFields,
          recurrence_rule: null,
          is_ongoing: false,
          date_time: d.toISOString(),
          end_time: durationMs !== null
            ? new Date(d.getTime() + durationMs).toISOString()
            : null,
        }));

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
      }

      router.push(`/events/${data.id}`);
    }

    router.refresh();
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
          rows={5}
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
      </div>

      {/* Recurrence — only for new events */}
      {!isEditing && (
        <div>
          <label className={labelClass}>Recurrence</label>
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
                  const result = await resolveZip(zip);
                  if (result) {
                    if (result.state) set("state", result.state);
                    if (result.country) set("country", result.country);
                  }
                }}
                className={inputClass}
              />
            </div>
          </div>
          {(form.state || form.country) && (
            <p className="text-cream-muted text-xs -mt-2">
              {[form.state, form.country].filter(Boolean).join(", ")}
            </p>
          )}

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
                  ✓ Located
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
        </div>
      )}

      {/* Virtual URL */}
      {form.event_type === "virtual" && (
        <div>
          <label className={labelClass}>Event link *</label>
          <input
            type="url"
            placeholder="https://zoom.us/j/… or similar"
            value={form.virtual_url}
            onChange={(e) => set("virtual_url", e.target.value)}
            className={inputClass}
          />
        </div>
      )}

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
        <div className="space-y-3">
          <label className={labelClass}>External ticketing</label>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { value: "", label: "No tickets" },
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
          {form.ticket_type && (
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
      </div>

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

        <div className="space-y-3">
          {readers.map((reader, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 grid grid-cols-2 gap-2">
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
              <button
                type="button"
                onClick={() => removeReader(i)}
                className="mt-3 text-cream-muted hover:text-cream transition text-lg leading-none"
                aria-label="Remove reader"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Series settings — only shown when editing the parent (first) event of a recurring series */}
      {isEditing && isParentEvent && (
        <div className="bg-navy border border-cream/10 rounded-2xl p-5 space-y-4">
          <p className="text-cream-muted text-xs uppercase tracking-wider">Series settings</p>

          <label className="flex items-center gap-4 cursor-pointer">
            <Toggle value={seriesOngoing} onChange={setSeriesOngoing} />
            <div>
              <span className="text-cream text-sm font-medium">Ongoing series</span>
              <p className="text-cream-muted text-xs">litly will keep generating upcoming occurrences automatically.</p>
            </div>
          </label>

          <div>
            <label className={labelClass}>Series end date (optional)</label>
            <input
              type="date"
              value={seriesEndDate}
              onChange={(e) => setSeriesEndDate(e.target.value)}
              className="bg-navy-light border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange [color-scheme:dark]"
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
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
        >
          {loading
            ? isEditing
              ? "Saving…"
              : "Publishing…"
            : isEditing
            ? "Save changes"
            : "Publish event"}
        </button>
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
