"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStatus("saving");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      router.push("/login");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      setError("Current password is incorrect.");
      setStatus("error");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError(updateError.message);
      setStatus("error");
      return;
    }

    setStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setTimeout(() => setStatus("idle"), 3000);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const body = await res.json();
      setError(body.error ?? "Failed to delete account.");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-cream mb-1">Account</h1>
        <p className="text-cream-muted">Manage your litly account.</p>
      </div>

      <Link
        href="/following"
        className="flex items-center justify-between bg-navy-light border border-cream/10 rounded-2xl p-6 mb-6 hover:border-orange/40 transition"
      >
        <div>
          <p className="text-cream font-medium">Following</p>
          <p className="text-cream-muted text-xs">Organizers you follow</p>
        </div>
        <span className="text-orange text-sm">View →</span>
      </Link>

      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
        <label className="text-cream-muted text-xs uppercase tracking-wider block">
          Change password
        </label>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-cream-muted text-xs mb-1 block">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="text-cream-muted text-xs mb-1 block">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            />
          </div>
          <div>
            <label className="text-cream-muted text-xs mb-1 block">Confirm new password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
            />
          </div>
          {error && <p className="text-orange text-xs">{error}</p>}
          <button
            type="submit"
            disabled={status === "saving" || !currentPassword || !newPassword || !confirm}
            className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
          >
            {status === "saving" ? "Updating…" : status === "saved" ? "Password updated!" : "Update password"}
          </button>
        </form>
      </div>
      {/* Delete account */}
      <div className="border-t border-cream/10 pt-8">
        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="w-full py-3 rounded-full border border-orange/40 text-orange text-sm font-medium hover:bg-orange/10 transition"
          >
            Delete account
          </button>
        ) : (
          <div className="bg-orange/10 border border-orange/30 rounded-2xl p-5 space-y-3">
            <p className="text-cream text-sm font-medium">Delete your account?</p>
            <p className="text-cream-muted text-xs">
              This permanently deletes your account and all saved events. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm"
              >
                Keep account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
