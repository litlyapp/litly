"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Genre, EventType } from "@/types/database";

interface RoundupEvent {
  id: string;
  title: string;
  genre: Genre | Genre[];
  event_type: EventType;
  date_time: string;
  timezone: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  is_imported: boolean;
  source_name: string | null;
  organizer: { name: string } | { name: string }[] | null;
}

const VIRTUAL = "__virtual__";
const STATE_PREFIX = "state:";

function hostName(event: RoundupEvent): string | null {
  if (event.is_imported && event.source_name) return event.source_name;
  const org = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
  return org?.name ?? null;
}

function eventLine(event: RoundupEvent): string {
  const time = new Date(event.date_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: event.timezone ?? undefined,
  });

  if (event.event_type === "virtual") {
    // • 9:00 AM — Title via Host
    const host = hostName(event);
    return host
      ? `• ${time} — ${event.title} via ${host}`
      : `• ${time} — ${event.title}`;
  }

  // • 6:00 PM — Title - Venue in City
  const venue = event.location_name;
  let line = `• ${time} — ${event.title}`;
  if (venue) line += ` - ${venue}`;
  if (event.city) line += ` in ${event.city}`;
  return line;
}

function monthLabel(events: RoundupEvent[]): string {
  const first = events[0];
  return new Date(first.date_time).toLocaleDateString("en-US", {
    month: "long",
    timeZone: first.timezone ?? undefined,
  });
}

function softCount(n: number): string {
  return n < 10 ? String(n) : `${Math.floor(n / 10) * 10}+`;
}

function buildCaption(
  events: RoundupEvent[],
  cityLabel: string
): string {
  const byDay = new Map<string, RoundupEvent[]>();
  for (const event of events) {
    const day = new Date(event.date_time).toLocaleDateString("en-US", {
      weekday: "long",
      month: "numeric",
      day: "numeric",
      timeZone: event.timezone ?? undefined,
    });
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }

  const sections = [...byDay.entries()].map(
    ([day, dayEvents]) =>
      `${day.toUpperCase()}\n${dayEvents.map((e) => eventLine(e)).join("\n")}`
  );

  const heading =
    cityLabel === "the literary internet"
      ? `upcoming online literary events`
      : `upcoming literary events in ${cityLabel}`;
  return [
    `📚 ${monthLabel(events)} at a glance: ${heading}`,
    `${softCount(events.length)} events posted — here are a few to note 👇`,
    ...sections,
    `See Details + RSVP at thelitlyapp.com (link in bio)`,
    `#literaryevents #bookcommunity #readersofinstagram #indielit #readingseries`,
  ].join("\n\n");
}

export default function AdminRoundupClient() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState<RoundupEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoadingData(true);
    const { data } = await supabase
      .from("events")
      .select(`id, title, genre, event_type, date_time, timezone, location_name,
               city, state, is_imported, source_name,
               organizer:organizer_profiles(name)`)
      .eq("is_cancelled", false)
      .gte("date_time", new Date().toISOString())
      .lte("date_time", new Date(Date.now() + 30 * 86400_000).toISOString())
      .order("date_time", { ascending: true });
    setEvents(data ?? []);
    setLoadingData(false);
    setAuthed(true);
  }

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (event.event_type === "in_person" && event.city) {
        const key = event.state ? `${event.city}, ${event.state}` : event.city;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const states = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (event.event_type === "in_person" && event.state) {
        counts.set(event.state, (counts.get(event.state) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);

  const virtualCount = useMemo(
    () => events.filter((e) => e.event_type === "virtual").length,
    [events]
  );

  const cutoff = Date.now() + days * 86400_000;
  const matching = events.filter((event) => {
    if (new Date(event.date_time).getTime() > cutoff) return false;
    if (selected === VIRTUAL) return event.event_type === "virtual";
    if (!selected) return false;
    if (event.event_type !== "in_person") return false;
    if (selected.startsWith(STATE_PREFIX)) {
      return event.state === selected.slice(STATE_PREFIX.length);
    }
    const key = event.state ? `${event.city}, ${event.state}` : event.city ?? "";
    return key === selected;
  });

  const cityLabel =
    selected === VIRTUAL
      ? "the literary internet"
      : selected.startsWith(STATE_PREFIX)
        ? selected.slice(STATE_PREFIX.length)
        : selected;
  const caption = matching.length ? buildCaption(matching, cityLabel) : "";

  async function handleCopy() {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass =
    "bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-32">
        <h1 className="font-serif text-3xl text-cream mb-8 text-center">Admin</h1>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full ${inputClass}`}
            autoFocus
          />
          <button
            type="submit"
            disabled={loadingData}
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {loadingData ? "Loading…" : "Enter"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-serif text-4xl text-cream mb-1">Social roundup</h1>
      <p className="text-cream-muted mb-8">
        Generate a &ldquo;this week in&rdquo; post from upcoming events.
      </p>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={inputClass}
        >
          <option value="">Pick a city or state…</option>
          <optgroup label="Cities">
            {cities.map(([city, count]) => (
              <option key={city} value={city}>
                {city} ({count})
              </option>
            ))}
          </optgroup>
          <optgroup label="States">
            {states.map(([state, count]) => (
              <option key={state} value={`${STATE_PREFIX}${state}`}>
                {state} ({count})
              </option>
            ))}
          </optgroup>
          <option value={VIRTUAL}>Online / virtual ({virtualCount})</option>
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={inputClass}
        >
          <option value={7}>Next 7 days</option>
          <option value={14}>Next 14 days</option>
          <option value={30}>Next 30 days</option>
        </select>
      </div>

      {selected && matching.length === 0 && (
        <p className="text-cream-muted">No upcoming events match.</p>
      )}

      {caption && (
        <div className="space-y-4">
          <textarea
            readOnly
            value={caption}
            rows={Math.min(24, caption.split("\n").length + 2)}
            className={`w-full ${inputClass} font-mono text-xs leading-relaxed`}
          />
          <div className="flex items-center gap-4">
            <button
              onClick={handleCopy}
              className="bg-orange text-cream text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition"
            >
              {copied ? "Copied!" : "Copy caption"}
            </button>
            <span className="text-cream-muted text-xs">
              {matching.length} event{matching.length === 1 ? "" : "s"} ·{" "}
              {caption.length} characters
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
