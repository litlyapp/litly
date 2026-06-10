"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

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

    // Check role to send organizers to dashboard, patrons to homepage
    const { data: { user: updatedUser } } = await supabase.auth.getUser();
    const destination = updatedUser
      ? (await supabase.from("users").select("role").eq("id", updatedUser.id).single()).data?.role === "organizer"
        ? "/dashboard"
        : "/"
      : "/";

    setStatus("done");
    setTimeout(() => router.push(destination), 2000);
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
            <p className="text-cream-muted text-sm">Redirecting you…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
              placeholder="New password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-navy-light border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-3 focus:outline-none focus:border-orange"
            />
            <PasswordInput
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
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
