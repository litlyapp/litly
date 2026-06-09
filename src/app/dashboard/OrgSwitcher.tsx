"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Org {
  id: string;
  name: string;
  role: string;
}

export default function OrgSwitcher({
  orgs,
  activeOrgId,
}: {
  orgs: Org[];
  activeOrgId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<"individual" | "organization">("individual");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function switchOrg(orgId: string) {
    setOpen(false);
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/account/become-organizer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgName: orgName.trim(), orgType }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to create org");
      setSubmitting(false);
      return;
    }

    // Switch to the newly created org
    await fetch("/api/org/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: data.orgId }),
    });

    setCreating(false);
    setOrgName("");
    setOrgType("individual");
    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setCreating(false); setError(null); }}
        className="flex items-center gap-2 bg-navy-light border border-cream/25 text-cream font-medium rounded-full px-4 py-1.5 hover:border-cream/50 hover:bg-navy transition text-base"
      >
        {activeOrg?.name ?? "Select org"}
        <svg className={`w-4 h-4 text-cream/60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-navy-light border border-cream/15 rounded-2xl shadow-xl overflow-hidden z-50">
          {!creating ? (
            <>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition ${
                    org.id === activeOrgId
                      ? "text-cream bg-orange/10"
                      : "text-cream-muted hover:text-cream hover:bg-navy"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {org.id === activeOrgId && (
                    <svg className="w-4 h-4 text-orange shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="border-t border-cream/10" />
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-4 py-3 text-sm text-orange hover:bg-navy transition flex items-center gap-2"
              >
                <span>＋</span> Create new org
              </button>
            </>
          ) : (
            <form onSubmit={handleCreate} className="p-4 space-y-3">
              <p className="text-cream text-sm font-medium">New organization</p>
              <input
                type="text"
                placeholder="Org name"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full bg-navy border border-cream/20 text-cream placeholder-cream-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
              />
              <select
                value={orgType}
                onChange={(e) => setOrgType(e.target.value as "individual" | "organization")}
                className="w-full bg-navy border border-cream/20 text-cream rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange"
              >
                <option value="individual">Individual organizer</option>
                <option value="organization">Organization / Series</option>
              </select>
              {error && <p className="text-orange text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || !orgName.trim()}
                  className="flex-1 bg-orange text-cream text-sm font-medium py-2 rounded-full hover:bg-orange/90 transition disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setError(null); }}
                  className="px-3 py-2 rounded-full border border-cream/20 text-cream-muted text-sm hover:text-cream transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
