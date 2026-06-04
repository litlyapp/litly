"use client";

import { useState, useCallback } from "react";
import DateTimePicker from "./DateTimePicker";
import BannerUpload from "./BannerUpload";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Genre, EventType, FeaturedReader } from "@/types/database";
import { GENRES } from "@/lib/genres";

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
  country: string | null;
  lat: number | null;
  lng: number | null;
  virtual_url: string | null;
  open_mic: boolean;
  featured_readers: FeaturedReader[] | null;
  rsvp_enabled: boolean;
  banner_url?: string | null;
  ticket_url?: string | null;
}

interface Props {
  organizerId: string;
  initialData?: EventData & { id?: string };
  eventId?: string;
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

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  // Convert UTC ISO to local time "YYYY-MM-DDTHH:MM" for the picker
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({ organizerId, initialData, eventId }: Props) {
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
    country: initialData?.country ?? "",
    virtual_url: initialData?.virtual_url ?? "",
    open_mic: initialData?.open_mic ?? false,
    rsvp_enabled: initialData?.rsvp_enabled ?? false,
    ticket_url: initialData?.ticket_url ?? "",
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
      banner_url: bannerUrl,
    };

    if (isEditing) {
      const { error: updateError } = await supabase
        .from("events")
        .update(sharedFields)
        .eq("id", eventId);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      router.push(`/events/${eventId}`);
    } else {
      const { data, error: insertError } = await supabase
        .from("events")
        .insert({ organizer_id: organizerId, ...sharedFields })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        setLoading(false);
        return;
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
                placeholder="e.g. New York"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country *</label>
              <input
                type="text"
                placeholder="e.g. USA"
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                className={inputClass}
              />
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

        <div>
          <label className={labelClass}>Ticket link (optional)</label>
          <input
            type="url"
            placeholder="https://eventbrite.com/… or your own ticketing page"
            value={form.ticket_url}
            onChange={(e) => set("ticket_url", e.target.value)}
            className={inputClass}
          />
          <p className="text-cream-muted/60 text-xs mt-1">
            Paid or external ticketing — litly will show a "Get tickets" button linking here.
          </p>
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

      {/* Error */}
      {error && (
        <p className="text-orange text-sm bg-orange/10 rounded-xl px-4 py-3">
          {error}
        </p>
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
          Cancel
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
