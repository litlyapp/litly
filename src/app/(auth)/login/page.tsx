"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const registered = searchParams.get("registered") === "1";
  const next = searchParams.get("next") ?? "/";

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
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

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
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
