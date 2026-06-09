"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [emailStatus, setEmailStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");
      setNewEmail(user.email ?? "");

      const { data } = await supabase.from("users").select("display_name").eq("id", user.id).single();
      setDisplayName(data?.display_name ?? "");
    }
    load();
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameStatus("saving");
    setNameError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase.from("users").update({ display_name: displayName.trim() }).eq("id", user.id);
    if (error) { setNameError(error.message); setNameStatus("error"); return; }

    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
    setNameStatus("saved");
    setTimeout(() => setNameStatus("idle"), 3000);
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailStatus("saving");
    setEmailError(null);

    if (newEmail === email) {
      setEmailError("That's already your email address.");
      setEmailStatus("error");
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) { setEmailError(error.message); setEmailStatus("error"); return; }

    setEmailStatus("sent");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);

    if (newPassword !== confirm) { setPwError("New passwords don't match."); return; }
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }

    setPwStatus("saving");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPwError("Could not verify user."); setPwStatus("error"); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (signInError) { setPwError("Current password is incorrect."); setPwStatus("error"); return; }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) { setPwError(updateError.message); setPwStatus("error"); return; }

    setPwStatus("saved");
    setCurrentPassword(""); setNewPassword(""); setConfirm("");
    setTimeout(() => setPwStatus("idle"), 3000);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      window.location.href = "/";
    } else {
      const body = await res.json();
      setDeleteError(body.error ?? "Failed to delete account.");
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

      {/* Name */}
      <form onSubmit={handleSaveName} className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4 mb-4">
        <label className="text-cream-muted text-xs uppercase tracking-wider block">Your name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => { setDisplayName(e.target.value); setNameStatus("idle"); }}
          required
          placeholder="Your name"
          className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
        {nameError && <p className="text-orange text-xs">{nameError}</p>}
        <button
          type="submit"
          disabled={nameStatus === "saving" || !displayName.trim()}
          className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
        >
          {nameStatus === "saving" ? "Saving…" : nameStatus === "saved" ? "Saved!" : "Save name"}
        </button>
      </form>

      {/* Email */}
      <form onSubmit={handleChangeEmail} className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4 mb-4">
        <label className="text-cream-muted text-xs uppercase tracking-wider block">Email address</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setEmailStatus("idle"); }}
          required
          className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
        {emailError && <p className="text-orange text-xs">{emailError}</p>}
        {emailStatus === "sent" && (
          <p className="text-green-400 text-xs">Confirmation sent to {newEmail}. Check your inbox to confirm the change.</p>
        )}
        <button
          type="submit"
          disabled={emailStatus === "saving" || emailStatus === "sent" || !newEmail}
          className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
        >
          {emailStatus === "saving" ? "Saving…" : emailStatus === "sent" ? "Confirmation sent" : "Update email"}
        </button>
      </form>

      {/* Password */}
      <form onSubmit={handleChangePassword} className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4 mb-4">
        <label className="text-cream-muted text-xs uppercase tracking-wider block">Change password</label>
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
            minLength={8}
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
        {pwError && <p className="text-orange text-xs">{pwError}</p>}
        <button
          type="submit"
          disabled={pwStatus === "saving" || !currentPassword || !newPassword || !confirm}
          className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
        >
          {pwStatus === "saving" ? "Updating…" : pwStatus === "saved" ? "Password updated!" : "Update password"}
        </button>
      </form>

      {/* Delete account */}
      <div className="border-t border-cream/10 pt-8">
        {deleteError && <p className="text-orange text-xs mb-3">{deleteError}</p>}
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
