"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface Props {
  user: User | null;
  role: string | null;
}

export default function NavClient({ user, role }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Close mobile menu on navigation
  function close() {
    setMenuOpen(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop auth controls */}
      <div className="hidden md:flex items-center gap-2">
        {!user ? (
          <>
            <Link
              href="/login"
              className="text-cream text-sm px-4 py-1.5 rounded-full border border-cream/30 hover:border-cream/60 transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-cream text-sm px-4 py-1.5 rounded-full bg-orange hover:bg-orange/90 transition"
            >
              Join
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/saved"
              className={`text-sm px-3 py-1.5 rounded-full hover:bg-navy-light transition ${
                isActive("/saved") ? "text-orange" : "text-cream-muted hover:text-cream"
              }`}
            >
              Saved
            </Link>
            {role === "organizer" && (
              <Link
                href="/dashboard"
                className={`text-sm px-3 py-1.5 rounded-full hover:bg-navy-light transition ${
                  isActive("/dashboard") ? "text-orange" : "text-cream-muted hover:text-cream"
                }`}
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/account"
              className={`text-sm px-3 py-1.5 rounded-full hover:bg-navy-light transition ${
                isActive("/account") ? "text-orange" : "text-cream-muted hover:text-cream"
              }`}
            >
              Account
            </Link>
            <button
              onClick={signOut}
              className="text-cream-muted hover:text-cream text-sm px-3 py-1.5 rounded-full hover:bg-navy-light transition"
            >
              Sign out
            </button>
          </>
        )}
      </div>

      {/* Mobile: auth buttons + hamburger grouped together */}
      <div className="md:hidden flex items-center gap-2">
        {!user && (
          <>
            <Link
              href="/login"
              className="text-cream text-sm px-3 py-1.5 rounded-full border border-cream/30 hover:border-cream/60 transition"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-cream text-sm px-3 py-1.5 rounded-full bg-orange hover:bg-orange/90 transition"
            >
              Join
            </Link>
          </>
        )}

        {/* Hamburger */}
        <button
          className="text-cream-muted hover:text-cream p-2 rounded-xl hover:bg-navy-light transition"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-navy border-b border-cream/10 z-50 px-4 py-4 flex flex-col gap-1">
          <MobileLink href="/events" onClick={close} active={isActive("/events")}>Events</MobileLink>
          <MobileLink href="/events/map" onClick={close} active={isActive("/events/map")}>Map</MobileLink>
          {role !== "organizer" && (
            <MobileLink
              href={user ? "/become-organizer" : "/register"}
              onClick={close}
              active={isActive("/become-organizer") || isActive("/register")}
            >
              Post an event
            </MobileLink>
          )}
          <MobileLink href="/support" onClick={close} active={isActive("/support")}>Support litly</MobileLink>

          {user ? (
            <>
              <div className="border-t border-cream/10 my-2" />
              <MobileLink href="/saved" onClick={close} active={isActive("/saved")}>Saved events</MobileLink>
              {role === "organizer" && (
                <>
                  <MobileLink href="/dashboard" onClick={close} active={isActive("/dashboard")}>Dashboard</MobileLink>
                  <MobileLink href="/events/new" onClick={close} active={isActive("/events/new")}>+ New event</MobileLink>
                </>
              )}
              <MobileLink href="/account" onClick={close} active={isActive("/account")}>Account</MobileLink>
              <button
                onClick={signOut}
                className="text-left text-cream-muted text-sm px-3 py-2 rounded-xl hover:bg-navy-light hover:text-cream transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="border-t border-cream/10 my-2" />
              <MobileLink href="/login" onClick={close} active={isActive("/login")}>Sign in</MobileLink>
              <Link
                href="/register"
                onClick={close}
                className="mt-1 block text-center bg-orange text-cream text-sm font-semibold px-4 py-2.5 rounded-full hover:bg-orange/90 transition"
              >
                Join litly
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}

function MobileLink({
  href,
  onClick,
  active,
  children,
}: {
  href: string;
  onClick: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`text-sm px-3 py-2 rounded-xl transition ${
        active
          ? "text-orange bg-navy-light"
          : "text-cream-muted hover:text-cream hover:bg-navy-light"
      }`}
    >
      {children}
    </Link>
  );
}
