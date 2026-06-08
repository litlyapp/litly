"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-cream mb-2">Reset password</h1>
          <p className="text-cream-muted">Enter your email and we'll send a reset link.</p>
        </div>

        {status === "sent" ? (
          <div className="bg-navy-light border border-cream/20 rounded-2xl p-6 text-center">
            <p className="text-cream mb-2">Check your email</p>
            <p className="text-cream-muted text-sm">A password reset link has been sent to <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />

            {status === "error" && (
              <p className="text-orange text-sm text-center">Something went wrong — please try again.</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-cream-muted text-sm text-center">
              <Link href="/login" className="text-cream-muted hover:text-orange">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
