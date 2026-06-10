"use client";

import { useState } from "react";
import Link from "next/link";
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

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDeleteOrg() {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/org/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: profile.id }),
      });

      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const body = await res.json();
        setDeleteError(body.error ?? "Failed to delete org.");
        setDeleting(false);
        setDeleteConfirm(false);
      }
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleting(false);
      setDeleteConfirm(false);
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

      {/* Delete org */}
      <div className="border-t border-cream/10 pt-8">
        {deleteError && <p className="text-orange text-xs mb-3">{deleteError}</p>}
        {!deleteConfirm ? (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="w-full py-3 rounded-full border border-orange/40 text-orange text-sm font-medium hover:bg-orange/10 transition"
          >
            Delete org
          </button>
        ) : (
          <div className="bg-orange/10 border border-orange/30 rounded-2xl p-5 space-y-3">
            <p className="text-cream text-sm font-medium">Delete {profile.name}?</p>
            <p className="text-cream-muted text-xs">
              This permanently deletes this org, its team, and all of its events. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDeleteOrg}
                disabled={deleting}
                className="px-5 py-2 rounded-full bg-orange text-cream text-sm font-medium hover:bg-orange/90 transition disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Yes, delete this org"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="px-5 py-2 rounded-full border border-cream/20 text-cream-muted hover:text-cream hover:border-cream/40 transition text-sm"
              >
                Keep org
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

