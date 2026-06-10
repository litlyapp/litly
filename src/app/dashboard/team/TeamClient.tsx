"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  user_id: string;
  role: "admin" | "editor";
  // Supabase returns joins as array; we normalise to single object below
  users: { email: string; display_name: string | null }[] | { email: string; display_name: string | null } | null;
}

interface Invite {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export default function TeamClient({
  orgId,
  members,
  pendingInvites,
  currentUserId,
}: {
  orgId: string;
  members: Member[];
  pendingInvites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, orgId }),
      });
      const data = await res.json();

      if (!res.ok) { setInviteError(data.error); return; }
      setInviteSuccess(true);
      setInviteEmail("");
      router.refresh();
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function resendInvite(email: string) {
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch("/api/org/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.error); return; }
      setInviteSuccess(true);
      router.refresh();
    } catch {
      setInviteError("Network error. Please try again.");
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!confirm("Cancel this invitation?")) return;
    try {
      const res = await fetch("/api/org/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error); return; }
      router.refresh();
    } catch {
      setActionError("Network error. Please try again.");
    }
  }

  async function changeRole(targetUserId: string, role: "admin" | "editor") {
    setActionError(null);
    try {
      const res = await fetch("/api/org/member", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, targetUserId, role }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error); return; }
      router.refresh();
    } catch {
      setActionError("Network error. Please try again.");
    }
  }

  async function removeMember(targetUserId: string) {
    setActionError(null);
    if (!confirm("Remove this team member?")) return;
    try {
      const res = await fetch("/api/org/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) { setActionError(data.error); return; }
      router.refresh();
    } catch {
      setActionError("Network error. Please try again.");
    }
  }

  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <div className="space-y-10">
      {/* Members list */}
      <section>
        <h2 className="font-serif text-2xl text-cream mb-4">Members</h2>
        {actionError && (
          <p className="text-orange text-sm mb-3">{actionError}</p>
        )}
        <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden">
          {members.map((member, i) => {
            const userInfo = Array.isArray(member.users) ? member.users[0] : member.users;
            const name = userInfo?.display_name || userInfo?.email || "Unknown";
            const isYou = member.user_id === currentUserId;
            const canRemove = !isYou || adminCount > 1;

            return (
              <div
                key={member.user_id}
                className={`flex items-center justify-between px-6 py-4 ${i < members.length - 1 ? "border-b border-cream/10" : ""}`}
              >
                <div>
                  <p className="text-cream font-medium text-sm">
                    {name}
                    {isYou && <span className="ml-2 text-cream-muted text-xs">(you)</span>}
                  </p>
                  <p className="text-cream-muted text-xs mt-0.5">{userInfo?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={member.role}
                    onChange={(e) => changeRole(member.user_id, e.target.value as "admin" | "editor")}
                    className="bg-navy border border-cream/20 text-cream text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange"
                    disabled={isYou && adminCount <= 1}
                    title={isYou && adminCount <= 1 ? "Cannot demote the last admin" : undefined}
                  >
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                  </select>
                  {canRemove && (
                    <button
                      onClick={() => removeMember(member.user_id)}
                      className="text-cream-muted hover:text-orange text-xs transition"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-cream-muted text-xs mt-3">
          <strong className="text-cream">Admins</strong> can manage team members and edit the org profile.{" "}
          <strong className="text-cream">Editors</strong> can post and edit events.
        </p>
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-cream mb-4">Pending invitations</h2>
          <div className="bg-navy-light border border-cream/10 rounded-2xl overflow-hidden">
            {pendingInvites.map((inv, i) => (
              <div
                key={inv.id}
                className={`flex items-center justify-between px-6 py-4 ${i < pendingInvites.length - 1 ? "border-b border-cream/10" : ""}`}
              >
                <div>
                  <p className="text-cream text-sm">{inv.email}</p>
                  <p className="text-cream-muted text-xs mt-0.5">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => resendInvite(inv.email)}
                    disabled={inviting}
                    className="text-cream-muted hover:text-orange text-xs transition disabled:opacity-60"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="text-cream-muted hover:text-orange text-xs transition"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite form */}
      <section>
        <h2 className="font-serif text-2xl text-cream mb-4">Invite someone</h2>
        <div className="bg-navy-light border border-cream/10 rounded-2xl p-6">
          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              placeholder="Email address"
              required
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(false); }}
              className="flex-1 bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange"
            />
            <button
              type="submit"
              disabled={inviting}
              className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm disabled:opacity-60 whitespace-nowrap"
            >
              {inviting ? "Sending…" : "Send invite"}
            </button>
          </form>
          {inviteError && <p className="text-orange text-sm mt-3">{inviteError}</p>}
          {inviteSuccess && (
            <p className="text-green-400 text-sm mt-3">Invitation sent!</p>
          )}
          <p className="text-cream-muted text-xs mt-3">
            They'll receive an email with a link to join your team. Invites expire after 7 days.
          </p>
        </div>
      </section>
    </div>
  );
}
