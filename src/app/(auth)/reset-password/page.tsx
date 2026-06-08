"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStatus("saving");

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("error");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/"), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl text-cream mb-2">New password</h1>
          <p className="text-cream-muted">Choose a new password for your account.</p>
        </div>

        {status === "done" ? (
          <div className="bg-navy-light border border-cream/20 rounded-2xl p-6 text-center">
            <p className="text-cream mb-2">Password updated</p>
            <p className="text-cream-muted text-sm">Redirecting you to the home page…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="New password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />

            {error && (
              <p className="text-orange text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full bg-orange text-cream font-semibold rounded-full py-3 hover:bg-orange/90 transition disabled:opacity-60"
            >
              {status === "saving" ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
