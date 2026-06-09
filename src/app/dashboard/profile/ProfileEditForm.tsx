"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";

interface Profile {
  id: string;
  name: string;
  org_type: string;
  bio: string | null;
  website: string | null;
  social_links: Record<string, string | undefined> | null;
  avatar_url: string | null;
}

export default function ProfileEditForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [instagram, setInstagram] = useState(profile.social_links?.instagram ?? "");
  const [twitter, setTwitter] = useState(profile.social_links?.twitter ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const social_links: Record<string, string> = {};
    if (instagram) social_links.instagram = instagram;
    if (twitter) social_links.twitter = twitter;

    const { error: updateError } = await supabase
      .from("organizer_profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        website: website.trim() || null,
        social_links: Object.keys(social_links).length ? social_links : null,
        avatar_url: avatarUrl,
      } as any)
      .eq("id", profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6">
        <label className="text-cream-muted text-xs uppercase tracking-wider mb-4 block">
          Profile photo
        </label>
        <AvatarUpload value={avatarUrl} name={name} onChange={setAvatarUrl} />
      </div>

      {/* Basic info */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
        </div>

        <div>
          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Tell people about your reading series, bookshop, or work…"
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange resize-none"
          />
        </div>

        <div>
          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
            Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
        </div>
      </div>

      {/* Social links */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
        <label className="text-cream-muted text-xs uppercase tracking-wider block">
          Social links
        </label>
        <div>
          <label className="text-cream-muted text-xs mb-1 block">Instagram URL</label>
          <input
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/…"
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
        </div>
        <div>
          <label className="text-cream-muted text-xs mb-1 block">X / Twitter URL</label>
          <input
            type="url"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="https://x.com/…"
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
        </div>
      </div>

      {error && <p className="text-orange text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-orange text-cream font-semibold py-3 rounded-full hover:bg-orange/90 transition disabled:opacity-60"
      >
        {saving ? "Saving…" : saved ? "Saved!" : "Save profile"}
      </button>

      <ChangePasswordSection />
      <DeleteAccountSection />
    </form>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setDeleting(false);
      return;
    }
    router.push("/");
  }

  return (
    <div className="bg-navy-light border border-red-900/40 rounded-2xl p-6 space-y-4">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="px-5 py-2 rounded-full border border-red-500/50 text-red-400 text-sm font-medium hover:bg-red-500/10 transition"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-cream-muted text-sm">
            This will permanently delete your account and all your events. This cannot be undone.
          </p>
          {error && <p className="text-orange text-xs">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted text-sm hover:border-cream/40 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2 rounded-full bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChangePasswordSection() {
  const supabase = createClient();
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

    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError("Could not verify user."); setStatus("error"); return; }

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

  return (
    <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
      <label className="text-cream-muted text-xs uppercase tracking-wider block">
        Change password
      </label>
      <div>
        <label className="text-cream-muted text-xs mb-1 block">Current password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
      </div>
      <div>
        <label className="text-cream-muted text-xs mb-1 block">New password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
      </div>
      <div>
        <label className="text-cream-muted text-xs mb-1 block">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
        />
      </div>
      {error && <p className="text-orange text-xs">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={status === "saving" || !currentPassword || !newPassword || !confirm}
        className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
      >
        {status === "saving" ? "Updating…" : status === "saved" ? "Password updated!" : "Update password"}
      </button>
    </div>
  );
}
