"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, OrgType } from "@/types/database";

interface Props {
  invite?: { token: string; orgName: string } | null;
}

export default function RegisterForm({ invite }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(invite ? 2 : 1);
  // Invite users register as patron — invite acceptance promotes them to org editor
  const [role, setRole] = useState<UserRole | null>(invite ? "patron" : null);
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
          display_name: form.displayName || undefined,
          org_type: role === "organizer" && !invite ? form.orgType : undefined,
          org_name: role === "organizer" && !invite ? form.orgName : undefined,
          bio: role === "organizer" && !invite ? (form.bio || undefined) : undefined,
          website: role === "organizer" && !invite ? (form.website || undefined) : undefined,
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
          {invite ? (
            <>
              <h1 className="font-serif text-4xl text-cream mb-2">Join {invite.orgName}</h1>
              <p className="text-cream-muted">Create an account to accept your invitation.</p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-4xl text-cream mb-2">Join litly</h1>
              <p className="text-cream-muted">Find your literary community.</p>
            </>
          )}
        </div>

        {step === 1 && !invite && (
          <div className="space-y-4">
            <p className="text-cream text-center text-lg mb-6">I want to…</p>

            <button
              onClick={() => { setRole("patron"); setStep(2); }}
              className="w-full p-6 rounded-2xl border border-cream/20 bg-navy-light hover:border-cream/40 text-left transition-all"
            >
              <div className="font-semibold text-cream text-lg mb-1">Discover events</div>
              <div className="text-cream-muted text-sm">
                Browse readings, save favorites, and RSVP as a patron.
              </div>
            </button>

            <button
              onClick={() => { setRole("organizer"); setStep(2); }}
              className="w-full p-6 rounded-2xl border border-cream/20 bg-navy-light hover:border-cream/40 text-left transition-all"
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
            {!invite && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-cream-muted text-sm hover:text-cream mb-2"
              >
                ← Back
              </button>
            )}

            <div className="border-b border-cream/10 pb-4 mb-4">
              <p className="text-cream-muted text-sm mb-3">Account</p>

              <input
                name="displayName"
                type="text"
                placeholder="Your name"
                required
                value={form.displayName}
                onChange={handleChange}
                className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange mb-3"
              />

              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange mb-3"
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
            </div>

            {role === "organizer" && !invite && (
              <div>
                <p className="text-cream-muted text-sm mb-3">Organization</p>

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
            )}

            {error && <p className="text-orange text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-cream-muted text-sm text-center">
              Already have an account?{" "}
              <Link
                href={invite ? `/login?next=${encodeURIComponent(`/join?invite=${invite.token}`)}` : "/login"}
                className="text-cream hover:text-orange"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
