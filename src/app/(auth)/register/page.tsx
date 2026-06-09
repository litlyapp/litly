"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, OrgType } from "@/types/database";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    orgName: "",
    orgType: "individual" as OrgType,
    bio: "",
    website: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role,
          display_name: role === "organizer" ? form.orgName : undefined,
          org_type: role === "organizer" ? form.orgType : undefined,
          org_name: role === "organizer" ? form.orgName : undefined,
          bio: role === "organizer" ? (form.bio || undefined) : undefined,
          website: role === "organizer" ? (form.website || undefined) : undefined,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-cream mb-2">Join litly</h1>
          <p className="text-cream-muted">Find your literary community.</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-cream text-center text-lg mb-6">I want to…</p>

            <button
              onClick={() => { setRole("patron"); setStep(2); }}
              className={`w-full p-6 rounded-2xl border text-left transition-all ${
                role === "patron"
                  ? "border-orange bg-navy-light"
                  : "border-cream/20 bg-navy-light hover:border-cream/40"
              }`}
            >
              <div className="font-semibold text-cream text-lg mb-1">Discover events</div>
              <div className="text-cream-muted text-sm">
                Browse readings, save favorites, and RSVP as a patron.
              </div>
            </button>

            <button
              onClick={() => { setRole("organizer"); setStep(2); }}
              className={`w-full p-6 rounded-2xl border text-left transition-all ${
                role === "organizer"
                  ? "border-orange bg-navy-light"
                  : "border-cream/20 bg-navy-light hover:border-cream/40"
              }`}
            >
              <div className="font-semibold text-cream text-lg mb-1">Post events</div>
              <div className="text-cream-muted text-sm">
                List readings and literary events as an organizer or series.
              </div>
            </button>
          </div>
        )}

        {step === 2 && role && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-cream-muted text-sm hover:text-cream mb-2"
            >
              ← Back
            </button>

            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={handleChange}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />

            <input
              name="password"
              type="password"
              placeholder="Password (min. 8 characters)"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />

            {role === "organizer" && (
              <>
                <div className="border-t border-cream/10 pt-4">
                  <p className="text-cream-muted text-sm mb-3">Organizer details</p>

                  <select
                    name="orgType"
                    value={form.orgType}
                    onChange={handleChange}
                    className="w-full bg-navy-light border border-cream/20 text-cream rounded-xl px-4 py-3 focus:outline-none focus:border-orange mb-3"
                  >
                    <option value="individual">Individual</option>
                    <option value="organization">Organization / Series</option>
                  </select>

                  <input
                    name="orgName"
                    type="text"
                    placeholder="Your name or organization name"
                    required
                    value={form.orgName}
                    onChange={handleChange}
                    className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange mb-3"
                  />

                  <textarea
                    name="bio"
                    placeholder="Short bio (optional)"
                    rows={3}
                    value={form.bio}
                    onChange={handleChange}
                    className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange mb-3 resize-none"
                  />

                  <input
                    name="website"
                    type="url"
                    placeholder="Website URL (optional)"
                    value={form.website}
                    onChange={handleChange}
                    className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-orange text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-cream-muted text-sm text-center">
              Already have an account?{" "}
              <Link href="/login" className="text-cream hover:text-orange">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
