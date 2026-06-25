"use client";

import { useState } from "react";
import { checkContent, checkContentRelaxed } from "@/lib/moderation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AvatarUpload from "@/components/AvatarUpload";
import BannerUpload from "@/components/BannerUpload";
import { GENRES } from "@/lib/genres";
import type { Genre } from "@/types/database";

interface Profile {
  id: string;
  name: string;
  org_type: string;
  bio: string | null;
  website: string | null;
  social_links: Record<string, string | undefined> | null;
  avatar_url: string | null;
  calendar_feed_url: string | null;
  calendar_feed_default_genre: Genre[] | null;
  calendar_feed_last_synced_at: string | null;
  calendar_feed_last_status: "success" | "error" | null;
  calendar_feed_last_error: string | null;
  default_banner_url: string | null;
  default_banner_for_all_events: boolean;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
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
  const [calendarFeedUrl, setCalendarFeedUrl] = useState(profile.calendar_feed_url ?? "");
  const [feedGenres, setFeedGenres] = useState<Genre[]>(profile.calendar_feed_default_genre ?? []);
  const [defaultBannerUrl, setDefaultBannerUrl] = useState<string | null>(profile.default_banner_url);
  const [defaultBannerForAll, setDefaultBannerForAll] = useState(profile.default_banner_for_all_events);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleFeedGenre(genre: Genre) {
    setFeedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  }

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedFeedUrl = calendarFeedUrl.trim();

    if (checkContent(name, bio).blocked) {
      setError("Your org profile contains content that isn't allowed on litly. Please remove any explicit language.");
      return;
    }

    setSaving(true);
    setError(null);

    const social_links: Record<string, string> = {};
    if (instagram) social_links.instagram = instagram;
    if (twitter) social_links.twitter = twitter;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: updated, error: updateError } = await db
      .from("organizer_profiles")
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        website: website.trim() || null,
        social_links: Object.keys(social_links).length ? social_links : null,
        avatar_url: avatarUrl,
        calendar_feed_url: trimmedFeedUrl || null,
        calendar_feed_default_genre: trimmedFeedUrl ? feedGenres : null,
        default_banner_url: defaultBannerUrl || null,
        default_banner_for_all_events: defaultBannerForAll,
      })
      .eq("id", profile.id)
      .select("id");

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
    } else if (!updated || updated.length === 0) {
      setError("Save failed: you don't have permission to edit this profile.");
    } else {
      // Retroactively apply default banner to existing synced events missing one
      if (defaultBannerUrl) {
        await fetch("/api/org/apply-defaults", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgId: profile.id }),
        });
      }

      // Trigger an immediate sync if a calendar feed URL was just added or changed
      const feedChanged =
        trimmedFeedUrl && trimmedFeedUrl !== (profile.calendar_feed_url ?? "").trim();
      if (feedChanged) {
        setSyncing(true);
        setSyncResult(null);
        try {
          const syncRes = await fetch("/api/org/sync-feed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId: profile.id }),
          });
          const syncBody = await syncRes.json();
          if (syncRes.ok) {
            const { newCount } = syncBody as { newCount: number };
            setSyncResult(
              newCount > 0
                ? `${newCount} new event${newCount !== 1 ? "s" : ""} imported as drafts — review them in your dashboard.`
                : "Feed synced — no new events found."
            );
          } else {
            setSyncResult(`Feed sync failed: ${syncBody.error ?? "unknown error"}`);
          }
        } catch {
          setSyncResult("Feed sync failed — your profile was saved. The daily sync will retry.");
        }
        setSyncing(false);
      }

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

      {/* Calendar feed sync */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
            Calendar feed URL (optional)
          </label>
          <p className="text-cream-muted text-xs mb-2">
            Paste your calendar&apos;s subscribe / iCal link and your events will sync here
            automatically — no need to post manually. Look for a calendar &quot;subscribe&quot; or
            &quot;export&quot; link on Google Calendar, Apple Calendar, Squarespace, Wix, WordPress events
            plugins, or Eventbrite.
          </p>
          <p className="text-cream-muted text-xs mb-2">
            Note: if you use Wix, Squarespace, or a similar site builder, events must be added
            to your site&apos;s built-in calendar — not just posted as pages or blog entries —
            for them to appear in the feed.
          </p>
          <input
            type="url"
            value={calendarFeedUrl}
            onChange={(e) => setCalendarFeedUrl(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/…"
            className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
          />
          {syncing && (
            <p className="text-cream-muted text-xs mt-2">Syncing your calendar feed…</p>
          )}
          {syncResult && !syncing && (
            <p className={`text-xs mt-2 ${syncResult.includes("failed") ? "text-orange" : "text-orange"}`}>
              {syncResult}
            </p>
          )}
          {profile.calendar_feed_url && !syncing && !syncResult && (
            <p className="text-cream-muted text-xs mt-2">
              {profile.calendar_feed_last_status === "error" ? (
                <span className="text-orange">
                  Couldn&apos;t reach your calendar feed
                  {profile.calendar_feed_last_error ? `: ${profile.calendar_feed_last_error}` : "."}
                </span>
              ) : profile.calendar_feed_last_synced_at ? (
                `Last synced ${timeAgo(profile.calendar_feed_last_synced_at)}`
              ) : (
                "Not synced yet — runs once daily."
              )}
            </p>
          )}
          <p className="text-cream-muted text-xs mt-2">
            Heads up: Calendar feeds don&apos;t carry banner images. Images must be manually added
            to all synced events from the edit page.
          </p>
        </div>

        {calendarFeedUrl.trim() && (
          <div>
            <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
              Genre for synced events (optional)
            </label>
            <p className="text-cream-muted text-xs mb-2">
              Your calendar feed doesn&apos;t carry genre info. If most of your events fall under
              one or two genres, tag them here so patrons can filter for you. If your events span
              all kinds of genres, leave this blank — your events will still show up no matter
              which genre filter someone uses.
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => {
                const active = feedGenres.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleFeedGenre(g.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      active
                        ? "bg-orange text-cream border-orange"
                        : "border-cream/20 text-cream-muted hover:border-cream/40"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Default event banner */}
      <div className="bg-navy-light border border-cream/10 rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-cream-muted text-xs uppercase tracking-wider mb-1.5 block">
            Default event banner (optional)
          </label>
          <p className="text-cream-muted text-xs mb-4">
            This banner is applied automatically to iCal-synced events that don&apos;t have their own image.
            Individual events can still have their own banner set from the edit page.
          </p>
        </div>
        <BannerUpload value={defaultBannerUrl} onChange={setDefaultBannerUrl} />
        {defaultBannerUrl && (
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <button
              type="button"
              onClick={() => setDefaultBannerForAll((v) => !v)}
              className={`w-11 h-6 rounded-full border transition relative shrink-0 ${
                defaultBannerForAll ? "bg-orange border-orange" : "bg-navy border-cream/30"
              }`}
              role="switch"
              aria-checked={defaultBannerForAll}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
                  defaultBannerForAll ? "left-5" : "left-0.5"
                }`}
              />
            </button>
            <div>
              <span className="text-cream text-sm font-medium">Apply to all new events</span>
              <p className="text-cream-muted text-xs">
                Pre-fill this banner on every new event you post, not just iCal imports. You can still swap it out per event.
              </p>
            </div>
          </label>
        )}
      </div>

      {error && <p className="text-orange text-sm">{error}</p>}

      <button
        type="submit"
        disabled={saving || syncing}
        className="w-full bg-orange text-cream font-semibold py-3 rounded-full hover:bg-orange/90 transition disabled:opacity-60"
      >
        {saving ? "Saving…" : syncing ? "Syncing feed…" : saved ? "Saved!" : "Save profile"}
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

