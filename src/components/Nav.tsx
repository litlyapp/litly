import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NavClient from "./NavClient";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = data?.role ?? null;
  }

  return (
    <nav className="bg-navy border-b border-cream/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <Link
          href="/"
          className="font-serif text-2xl text-cream tracking-tight hover:text-orange transition"
        >
          litly
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/events">Events</NavLink>
          <NavLink href="/events/map">Map</NavLink>
        </div>

        {/* Auth controls + mobile menu (client) */}
        <NavClient user={user} role={role} />
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-cream-muted hover:text-cream text-sm px-3 py-1.5 rounded-full hover:bg-navy-light transition"
    >
      {children}
    </Link>
  );
}
