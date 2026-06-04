"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DateTimePicker from "@/components/DateTimePicker";
import { GENRES, GENRE_LABELS } from "@/lib/genres";
import type { Genre, EventType } from "@/types/database";

interface PendingImport {
  id: string;
  source_email: string | null;
  source_subject: string | null;
  raw_body: string | null;
  parsed_data: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return String(iso).slice(0, 16);
}

const inputClass =
  "w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

export default function AdminQueueClient({
  initialItems,
}: {
  initialItems: PendingImport[];
}) {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.trim()) setAuthed(true);
  }

  function startEdit(item: PendingImport) {
    setEditing(item.id);
    setEditData(item.parsed_data ?? {});
    setError(null);
  }

  async function handleApprove(item: PendingImport) {
    setLoading(true);
    setError(null);

    const data = editing === item.id ? editData : (item.parsed_data ?? {});

    const res = await fetch("/api/admin/import-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: data, password }),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to import");
      setLoading(false);
      return;
    }

    // Mark as approved
    await fetch("/api/admin/queue-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "approved", password }),
    });

    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setEditing(null);
    setLoading(false);
    router.refresh();
  }

  async function handleReject(id: string) {
    await fetch("/api/admin/queue-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "rejected", password }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function setField(key: string, value: unknown) {
    setEditData((prev) => ({ ...prev, [key]: value }));
  }

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
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-cream mb-1">Import queue</h1>
          <p className="text-cream-muted">
            {items.length === 0
              ? "Queue is empty."
              : `${items.length} event${items.length !== 1 ? "s" : ""} waiting for review`}
          </p>
        </div>
      </div>

      {items.length === 0 && (
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-16 text-center">
          <p className="font-serif text-2xl text-cream mb-2">All clear</p>
          <p className="text-cream-muted text-sm">
            No pending imports. New newsletter events will appear here automatically.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {items.map((item) => {
          const isEditing = editing === item.id;
          const data = isEditing ? editData : (item.parsed_data ?? {});
          const genres = (data.genre as Genre[] | undefined) ?? [];

          return (
            <div
              key={item.id}
              className="bg-navy-light border border-cream/10 rounded-2xl p-6"
            >
              {/* Source info */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-cream-muted text-xs mb-0.5">
                    From: {item.source_email}
                  </p>
                  <p className="text-cream-muted text-xs">
                    Subject: {item.source_subject}
                  </p>
                </div>
                <span className="text-cream-muted/50 text-xs shrink-0">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Original email body */}
              {item.raw_body && (
                <details className="mb-4">
                  <summary className="text-cream-muted text-xs cursor-pointer hover:text-cream transition select-none">
                    View original email ▾
                  </summary>
                  <div className="mt-2 bg-navy border border-cream/10 rounded-xl p-3 text-cream-muted text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {item.raw_body}
                  </div>
                </details>
              )}

              {data.title ? (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Title</label>
                    {isEditing ? (
                      <input
                        value={String(data.title ?? "")}
                        onChange={(e) => setField("title", e.target.value)}
                        className={inputClass}
                      />
                    ) : (
                      <p className="text-cream font-medium">{String(data.title)}</p>
                    )}
                  </div>

                  {/* Genre pills */}
                  <div>
                    <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Genre</label>
                    {isEditing ? (
                      <div className="flex flex-wrap gap-2">
                        {GENRES.map((g) => {
                          const active = genres.includes(g.value);
                          return (
                            <button
                              key={g.value}
                              type="button"
                              onClick={() =>
                                setField(
                                  "genre",
                                  active
                                    ? genres.filter((x) => x !== g.value)
                                    : [...genres, g.value]
                                )
                              }
                              className={`px-3 py-1 rounded-full text-xs border transition ${
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
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {genres.map((g) => (
                          <span key={g} className="px-2 py-0.5 rounded-full bg-orange/15 text-orange text-xs">
                            {GENRE_LABELS[g]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  {isEditing ? (
                    <DateTimePicker
                      label="Date & time"
                      value={toDatetimeLocal(data.date_time as string)}
                      onChange={(v) => setField("date_time", v || null)}
                    />
                  ) : (
                    <p className="text-cream-muted text-sm">
                      {data.date_time
                        ? new Date(String(data.date_time)).toLocaleString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })
                        : "Date TBD"}
                    </p>
                  )}

                  {/* Location */}
                  {isEditing ? (
                    <div>
                      <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
                        {data.event_type === "virtual" ? "Event link" : "Venue"}
                      </label>
                      <input
                        value={String(data.event_type === "virtual" ? (data.virtual_url ?? "") : (data.location_name ?? ""))}
                        onChange={(e) =>
                          setField(
                            data.event_type === "virtual" ? "virtual_url" : "location_name",
                            e.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  ) : (
                    <p className="text-cream-muted text-sm">
                      {data.event_type === "virtual"
                        ? "Virtual event"
                        : String(data.location_name ?? "Location TBD")}
                    </p>
                  )}

                  {/* Event type toggle in edit mode */}
                  {isEditing && (
                    <div>
                      <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Event type</label>
                      <div className="flex gap-3">
                        {(["in_person", "virtual"] as EventType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setField("event_type", t)}
                            className={`flex-1 py-2 rounded-full border text-sm transition ${
                              data.event_type === t
                                ? "bg-orange border-orange text-cream"
                                : "border-cream/20 text-cream-muted hover:border-cream hover:text-cream"
                            }`}
                          >
                            {t === "in_person" ? "In Person" : "Virtual"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-cream-muted text-sm italic">
                  No events could be extracted from this email.
                </p>
              )}

              {error && editing === item.id && (
                <p className="text-orange text-sm mt-3">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-5 pt-4 border-t border-cream/10">
                {!!data.title && (
                  <>
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={loading}
                      className="bg-orange text-cream text-sm font-semibold px-5 py-2 rounded-full hover:bg-orange/90 transition disabled:opacity-60"
                    >
                      {loading && editing === item.id ? "Importing…" : "Approve & import"}
                    </button>
                    <button
                      onClick={() => isEditing ? setEditing(null) : startEdit(item)}
                      className="border border-cream/20 text-cream-muted text-sm px-4 py-2 rounded-full hover:text-cream hover:border-cream/40 transition"
                    >
                      {isEditing ? "Cancel edit" : "Edit"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleReject(item.id)}
                  className="border border-cream/20 text-cream-muted text-sm px-4 py-2 rounded-full hover:text-orange hover:border-orange/40 transition ml-auto"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
