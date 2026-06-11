"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Genre, EventType } from "@/types/database";
import { GENRE_LABELS } from "@/lib/genres";

interface AdminEvent {
  id: string;
  title: string;
  genre: Genre | Genre[];
  event_type: EventType;
  date_time: string;
  is_imported: boolean;
  source_name: string | null;
  banner_url: string | null;
  organizer: { id: string; name: string } | { id: string; name: string }[] | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function AdminEventsClient() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoadingData(true);
    const { data } = await supabase
      .from("events")
      .select(`id, title, genre, event_type, date_time, is_imported, source_name, banner_url,
               organizer:organizer_profiles(id, name)`)
      .order("date_time", { ascending: false });
    setEvents(data ?? []);
    setLoadingData(false);
    setAuthed(true);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const { data: deleted, error } = await supabase
      .from("events")
      .delete()
      .eq("id", id)
      .select("id");
    if (error || !deleted || deleted.length === 0) {
      alert(
        "Failed to delete event: " +
          (error ? error.message : "no permission to delete this event")
      );
      setDeleting(null);
      setConfirming(null);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setConfirming(null);
    setDeleting(null);
    router.refresh();
  }

  const filtered = events.filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const inputClass = "bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

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
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-4xl text-cream mb-1">All events</h1>
          <p className="text-cream-muted">{events.length} total</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/import"
            className="bg-orange text-cream text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition"
          >
            + Import event
          </Link>
          <Link
            href="/events/new"
            className="border border-cream/20 text-cream text-sm px-5 py-2.5 rounded-full hover:border-cream/40 transition"
          >
            + Post event
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search events…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`w-full ${inputClass} mb-6`}
      />

      {/* Events table */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-10 text-center text-cream-muted">No events found.</div>
        )}
        {filtered.map((event, i) => {
          const organizer = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
          const isConfirming = confirming === event.id;
          const isDeleting = deleting === event.id;
          const isPast = new Date(event.date_time) < new Date();

          return (
            <div
              key={event.id}
              className={`px-5 py-4 flex items-start gap-4 ${i < filtered.length - 1 ? "border-b border-cream/10" : ""} ${isPast ? "opacity-50" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {(Array.isArray(event.genre) ? event.genre : [event.genre]).map((g) => (
                    <span key={g} className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs">
                      {GENRE_LABELS[g]}
                    </span>
                  ))}
                  {event.is_imported && (
                    <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
                      imported · {event.source_name}
                    </span>
                  )}
                  {event.banner_url && (
                    <span className="px-2 py-0.5 rounded-full bg-cream/10 text-cream-muted text-xs">
                      📷 banner
                    </span>
                  )}
                </div>
                <Link
                  href={`/events/${event.id}`}
                  className="text-cream font-medium hover:text-orange transition line-clamp-1"
                >
                  {event.title}
                </Link>
                <p className="text-cream-muted text-xs mt-0.5">
                  {formatDate(event.date_time)} · {organizer?.name ?? "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isConfirming ? (
                  <>
                    <span className="text-cream-muted text-xs">Delete?</span>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={isDeleting}
                      className="text-orange text-xs border border-orange/40 rounded-full px-3 py-1 hover:bg-orange/10 transition disabled:opacity-60"
                    >
                      {isDeleting ? "…" : "Yes"}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1 hover:text-cream transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-cream hover:border-cream/40 transition"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setConfirming(event.id)}
                      className="text-cream-muted text-xs border border-cream/20 rounded-full px-3 py-1.5 hover:text-orange hover:border-orange/40 transition"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
