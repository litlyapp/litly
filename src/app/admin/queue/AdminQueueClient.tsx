"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DateTimePicker from "@/components/DateTimePicker";
import BannerUpload from "@/components/BannerUpload";
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

// Show the literal wall-clock time written in the parsed ISO string — never
// run it through Date(), which re-interprets it in the browser's timezone and
// shifts edited times (e.g. 10 AM becomes 1 AM for an admin in GMT+9)
function toDatetimeLocal(iso: string | null | undefined): string {
  return String(iso ?? "").match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)?.[0] ?? "";
}

// Preserve the source's timezone offset (e.g. "-04:00" or "Z") when the admin
// edits the wall-clock time, so the stored instant stays correct
function offsetOf(iso: string | null | undefined): string {
  return String(iso ?? "").match(/(Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "";
}

// Format the event's own wall-clock time without timezone re-interpretation
function formatWallClock(iso: string | null | undefined): string {
  const m = toDatetimeLocal(iso);
  if (!m) return "Date TBD";
  const [datePart, timePart] = m.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  return new Date(y, mo - 1, d, h, min).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// At-a-glance readiness so complete items can be approved without opening the
// editor, and gaps are visible before an event goes live
function CompletenessBadges({ data }: { data: Record<string, unknown> }) {
  const virtual = data.event_type === "virtual";
  const checks: { label: string; ok: boolean; note?: string }[] = [
    { label: "Date", ok: !!data.date_time },
    {
      label: "Time",
      ok: !!data.date_time && data.time_confirmed !== false,
      note: data.time_confirmed === false ? "not stated in source" : undefined,
    },
    ...(virtual
      ? [{ label: "Link", ok: !!data.virtual_url }]
      : [
          { label: "Venue", ok: !!data.location_name },
          {
            label: "Address",
            ok: !!data.address && !!data.city,
            note: data.venue_filled_from ? "from past events" : undefined,
          },
        ]),
    { label: "Description", ok: !!data.description },
  ];
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {checks.map((c) => (
        <span
          key={c.label}
          className={`px-2 py-0.5 rounded-full text-xs border ${
            c.ok
              ? "border-cream/15 text-cream-muted"
              : "border-orange/50 bg-orange/10 text-orange"
          }`}
        >
          {c.ok ? "✓" : "✗"} {c.label}
          {c.note ? ` (${c.note})` : ""}
        </span>
      ))}
    </div>
  );
}

const inputClass =
  "w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

export default function AdminQueueClient() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<PendingImport[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/queue-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(res.status === 429 ? "Too many attempts. Try again later." : "Invalid password.");
        return;
      }
      const { items: fetched } = await res.json();
      setItems(fetched);
      setAuthed(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingData(false);
    }
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

    try {
      // Single call: imports the event AND marks the queue item approved
      const res = await fetch("/api/admin/import-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: data, password, queueId: item.id }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to import");
        setLoading(false);
        return;
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setEditing(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await fetch("/api/admin/queue-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "rejected", password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to reject");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError("Network error. Please try again.");
    }
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
          {error && <p className="text-orange text-sm">{error}</p>}
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
                  {typeof (item.parsed_data?.source_url) === "string" &&
                    /^https?:\/\//.test(item.parsed_data.source_url as string) && (
                    <a
                      href={item.parsed_data.source_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange text-xs hover:underline"
                    >
                      View original event ↗
                    </a>
                  )}
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
                  <CompletenessBadges data={data} />

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
                      onChange={(v) =>
                        setField("date_time", v ? v + offsetOf(item.parsed_data?.date_time as string) : null)
                      }
                    />
                  ) : (
                    <p className={`text-sm font-medium ${data.time_confirmed === false ? "text-orange" : "text-cream"}`}>
                      {formatWallClock(data.date_time as string)}
                      {data.time_confirmed === false && " — ⚠ time not stated in source"}
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

                  {/* Full field set so imports don't need a post-import edit pass */}
                  {isEditing && (
                    <>
                      <div>
                        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Description</label>
                        <textarea
                          value={String(data.description ?? "")}
                          onChange={(e) => setField("description", e.target.value || null)}
                          rows={4}
                          className={inputClass}
                        />
                      </div>

                      <DateTimePicker
                        label="End time (optional)"
                        value={toDatetimeLocal(data.end_time as string)}
                        onChange={(v) =>
                          setField("end_time", v ? v + offsetOf(item.parsed_data?.end_time as string) : null)
                        }
                      />

                      {data.event_type !== "virtual" && (
                        <>
                          <div>
                            <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Address</label>
                            <input
                              value={String(data.address ?? "")}
                              onChange={(e) => setField("address", e.target.value || null)}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {(["city", "state", "country"] as const).map((f) => (
                              <div key={f}>
                                <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">{f}</label>
                                <input
                                  value={String(data[f] ?? "")}
                                  onChange={(e) => setField(f, e.target.value || null)}
                                  className={inputClass}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                        <div>
                          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">Tickets</label>
                          <select
                            value={String(data.ticket_type ?? "")}
                            onChange={(e) => {
                              setField("ticket_type", e.target.value || null);
                              if (!e.target.value) setField("ticket_url", null);
                            }}
                            className={inputClass}
                          >
                            <option value="">None</option>
                            <option value="free">Free / RSVP</option>
                            <option value="paid">Paid</option>
                          </select>
                        </div>
                        {!!data.ticket_type && (
                          <input
                            type="url"
                            placeholder="https://… ticket or registration link"
                            value={String(data.ticket_url ?? "")}
                            onChange={(e) => setField("ticket_url", e.target.value || null)}
                            className={inputClass}
                          />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-cream-muted text-xs uppercase tracking-wider block">Featured readers</label>
                          <button
                            type="button"
                            onClick={() =>
                              setField("featured_readers", [
                                ...((data.featured_readers as { name: string; url: string }[]) ?? []),
                                { name: "", url: "" },
                              ])
                            }
                            className="text-orange text-xs hover:text-orange/80 transition"
                          >
                            + Add reader
                          </button>
                        </div>
                        {((data.featured_readers as { name: string; url: string }[]) ?? []).map((reader, ri) => (
                          <div key={ri} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                            <input
                              placeholder="Name"
                              value={reader.name}
                              onChange={(e) => {
                                const next = [...((data.featured_readers as { name: string; url: string }[]) ?? [])];
                                next[ri] = { ...next[ri], name: e.target.value };
                                setField("featured_readers", next);
                              }}
                              className={inputClass}
                            />
                            <input
                              placeholder="Link (optional)"
                              value={reader.url}
                              onChange={(e) => {
                                const next = [...((data.featured_readers as { name: string; url: string }[]) ?? [])];
                                next[ri] = { ...next[ri], url: e.target.value };
                                setField("featured_readers", next);
                              }}
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = ((data.featured_readers as { name: string; url: string }[]) ?? []).filter((_, i) => i !== ri);
                                setField("featured_readers", next.length ? next : null);
                              }}
                              className="text-cream-muted text-xs hover:text-orange transition px-2"
                              aria-label="Remove reader"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <BannerUpload
                        value={(data.banner_url as string | null) ?? null}
                        onChange={(url) => setField("banner_url", url)}
                      />
                    </>
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
