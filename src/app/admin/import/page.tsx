"use client";

import { useState } from "react";
import type { Genre, EventType } from "@/types/database";
import DateTimePicker from "@/components/DateTimePicker";
import { GENRES, GENRE_LABELS } from "@/lib/genres";

interface ParsedEvent {
  title: string;
  description: string | null;
  genre: Genre[];
  event_type: EventType;
  date_time: string | null;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  virtual_url: string | null;
  open_mic: boolean;
  featured_readers: { name: string; url: string }[] | null;
  source_name: string | null;
  source_url?: string | null;
  ignore?: boolean;
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export default function AdminImportPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEvent | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function checkPassword(e: React.FormEvent) {
    e.preventDefault();
    // Quick client-side check — real auth happens server-side on each request
    if (password.trim()) setAuthed(true);
  }

  async function handleParse(e: React.FormEvent) {
    e.preventDefault();
    setParsing(true);
    setError(null);
    setParsed(null);
    setSuccess(false);

    const res = await fetch("/api/admin/parse-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to parse");
      setParsing(false);
      return;
    }

    if (data.parsed.ignore) {
      setError("Claude flagged this as a non-literary event. Edit the text or try a different source.");
      setParsing(false);
      return;
    }

    setParsed({ ...data.parsed, source_url: sourceUrl || null });
    setParsing(false);
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError(null);

    const res = await fetch("/api/admin/import-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: parsed, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to import");
      setImporting(false);
      return;
    }

    setSuccess(true);
    setImporting(false);
    setParsed(null);
    setInput("");
    setSourceUrl("");
  }

  const inputClass =
    "w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-32">
        <h1 className="font-serif text-3xl text-cream mb-8 text-center">Admin</h1>
        <form onSubmit={checkPassword} className="space-y-4">
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
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
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Import event</h1>
        <p className="text-cream-muted text-sm">
          Paste a URL, event page text, or any raw event info. Claude will extract the details.
        </p>
      </div>

      {success && (
        <div className="bg-orange/15 border border-orange/30 rounded-2xl p-4 mb-6 text-orange text-sm">
          ✓ Event imported successfully and is now live on litly.
        </div>
      )}

      {/* Input form */}
      {!parsed && (
        <form onSubmit={handleParse} className="space-y-4">
          <div>
            <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
              Source URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
              Event text or URL content *
            </label>
            <textarea
              placeholder="Paste a URL, the full text of an event listing, an email, a Facebook post — anything with event details…"
              rows={10}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && (
            <p className="text-orange text-sm bg-orange/10 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={parsing}
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {parsing ? "Parsing with Claude…" : "Parse event"}
          </button>
        </form>
      )}

      {/* Review parsed event */}
      {parsed && (
        <div className="space-y-5">
          <div className="bg-navy-light border border-cream/10 rounded-2xl p-5">
            <p className="text-cream-muted text-xs uppercase tracking-wider mb-4">Review before importing</p>

            <div className="space-y-4">
              <div>
                <label className="text-cream-muted text-xs mb-1 block">Title</label>
                <input
                  value={parsed.title}
                  onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-cream-muted text-xs mb-1 block">Description</label>
                <textarea
                  value={parsed.description ?? ""}
                  onChange={(e) => setParsed({ ...parsed, description: e.target.value || null })}
                  rows={4}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div>
                <label className="text-cream-muted text-xs mb-1 block">Genre</label>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => {
                    const active = parsed.genre.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() =>
                          setParsed({
                            ...parsed,
                            genre: active
                              ? parsed.genre.filter((x) => x !== g.value)
                              : [...parsed.genre, g.value],
                          })
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
              </div>

              <div>
                <label className="text-cream-muted text-xs mb-1 block">Event type</label>
                <select
                  value={parsed.event_type}
                  onChange={(e) => setParsed({ ...parsed, event_type: e.target.value as EventType })}
                  className={inputClass}
                >
                  <option value="in_person">In Person</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>

              <div className="space-y-3">
                <DateTimePicker
                  label="Start date & time"
                  value={toDatetimeLocal(parsed.date_time)}
                  onChange={(v) => setParsed({ ...parsed, date_time: v || null })}
                />
                <DateTimePicker
                  label="End time (optional)"
                  value={toDatetimeLocal(parsed.end_time)}
                  onChange={(v) => setParsed({ ...parsed, end_time: v || null })}
                />
              </div>

              {parsed.event_type === "in_person" && (
                <>
                  <div>
                    <label className="text-cream-muted text-xs mb-1 block">Venue</label>
                    <input
                      value={parsed.location_name ?? ""}
                      onChange={(e) => setParsed({ ...parsed, location_name: e.target.value || null })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-cream-muted text-xs mb-1 block">Address</label>
                    <input
                      value={parsed.address ?? ""}
                      onChange={(e) => setParsed({ ...parsed, address: e.target.value || null })}
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {parsed.event_type === "virtual" && (
                <div>
                  <label className="text-cream-muted text-xs mb-1 block">Event link</label>
                  <input
                    value={parsed.virtual_url ?? ""}
                    onChange={(e) => setParsed({ ...parsed, virtual_url: e.target.value || null })}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className="text-cream-muted text-xs mb-1 block">Source name</label>
                <input
                  value={parsed.source_name ?? ""}
                  onChange={(e) => setParsed({ ...parsed, source_name: e.target.value || null })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="text-cream-muted text-xs mb-1 block">Source URL</label>
                <input
                  value={parsed.source_url ?? ""}
                  onChange={(e) => setParsed({ ...parsed, source_url: e.target.value || null })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-orange text-sm bg-orange/10 rounded-xl px-4 py-3">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {importing ? "Importing…" : "Import to litly"}
            </button>
            <button
              onClick={() => { setParsed(null); setError(null); }}
              className="px-6 py-3 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
