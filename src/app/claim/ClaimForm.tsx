"use client";

import { useState } from "react";

interface Props {
  eventId: string;
  eventTitle: string;
  sourceName: string | null;
}

const inputClass =
  "w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange";

export default function ClaimForm({ eventId, eventTitle, sourceName }: Props) {
  const [form, setForm] = useState({
    orgName: sourceName ?? "",
    contactName: "",
    email: "",
    website: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, ...form }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-8 text-center">
        <p className="font-serif text-2xl text-cream mb-2">Request received</p>
        <p className="text-cream-muted text-sm leading-relaxed">
          Thanks! We review every claim personally — you&apos;ll hear from us at{" "}
          <span className="text-cream">{form.email}</span> within a day or two
          with an invite to manage your page.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-navy-light border border-cream/10 rounded-2xl p-8 space-y-5"
    >
      <p className="text-cream-muted text-sm">
        Claiming: <span className="text-cream font-medium">{eventTitle}</span>
      </p>

      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
          Organization or series name
        </label>
        <input
          name="orgName"
          required
          maxLength={120}
          value={form.orgName}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
          Your name
        </label>
        <input
          name="contactName"
          required
          maxLength={120}
          value={form.contactName}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
          Email
        </label>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          value={form.email}
          onChange={handleChange}
          className={inputClass}
          placeholder="you@yourorg.org"
        />
      </div>

      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
          Org website or social link (optional)
        </label>
        <input
          name="website"
          maxLength={300}
          value={form.website}
          onChange={handleChange}
          className={inputClass}
          placeholder="https://"
        />
      </div>

      <div>
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-1 block">
          Anything we should know? (optional)
        </label>
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          value={form.message}
          onChange={handleChange}
          className={inputClass}
          placeholder="Your role, other events of yours we've listed, etc."
        />
      </div>

      {error && <p className="text-orange text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
      >
        {loading ? "Sending…" : "Submit claim"}
      </button>
    </form>
  );
}
