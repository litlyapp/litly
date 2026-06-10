"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const registered = searchParams.get("registered") === "1";
  const confirmed = searchParams.get("confirmed") === "1";
  // Validate next is a same-origin relative path to prevent open redirect
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Accept any pending org invites (safety net — the signup-confirmation
    // callback misses them when the link is opened on another device)
    let joinedOrg = false;
    try {
      const res = await fetch("/api/org/accept-pending", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        joinedOrg = (data.accepted ?? 0) > 0;
      }
    } catch {
      // non-fatal — invites can still be accepted via the join link
    }

    // Send organizers to dashboard, patrons to homepage (or the requested next page)
    let destination = next !== "/" ? next : "/";
    if (joinedOrg) {
      destination = "/dashboard?joined=1";
    } else if (destination === "/" && user) {
      const { data: userRow } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (userRow?.role === "organizer") destination = "/dashboard";
    }

    window.location.href = destination;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-cream mb-2">Welcome back</h1>
          <p className="text-cream-muted">Sign in to your litly account.</p>
        </div>

        {registered && (
          <div className="bg-navy-light border border-cream/20 rounded-2xl p-4 mb-6 text-cream-muted text-sm text-center">
            Account created! Check your email to confirm, then sign in.
          </div>
        )}

        {confirmed && (
          <div className="bg-orange/10 border border-orange/30 rounded-2xl p-4 mb-6 text-cream text-sm text-center">
            Email confirmed — you&apos;re all set. Sign in below.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={handleChange}
            className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
          />

          <PasswordInput
            name="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
          />

          {error && (
            <p className="text-orange text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-cream-muted text-sm text-center">
            <Link href="/forgot-password" className="text-cream-muted hover:text-orange">
              Forgot password?
            </Link>
          </p>

          <p className="text-cream-muted text-sm text-center">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-cream hover:text-orange">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
