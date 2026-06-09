"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgType } from "@/types/database";

export default function BecomeOrganizerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    orgName: "",
    orgType: "individual" as OrgType,
    bio: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/account/become-organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    // Refresh session so the new role is picked up, then go post an event
    router.refresh();
    router.push("/events/new");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-cream mb-2">Post events on litly</h1>
          <p className="text-cream-muted">
            Set up your organizer profile — it only takes a moment.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <select
              name="orgType"
              value={form.orgType}
              onChange={handleChange}
              className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            >
              <option value="individual">Individual</option>
              <option value="organization">Organization / Series</option>
            </select>
          </div>

          <input
            name="orgName"
            type="text"
            placeholder="Your name or organization name"
            required
            value={form.orgName}
            onChange={handleChange}
            className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
          />

          <textarea
            name="bio"
            placeholder="Short bio (optional)"
            rows={3}
            value={form.bio}
            onChange={handleChange}
            className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange resize-none"
          />

          <input
            name="website"
            type="url"
            placeholder="Website URL (optional)"
            value={form.website}
            onChange={handleChange}
            className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
          />

          {error && <p className="text-orange text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {loading ? "Setting up your profile…" : "Continue to post an event"}
          </button>
        </form>
      </div>
    </div>
  );
}
