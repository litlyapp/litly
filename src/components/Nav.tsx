import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import NavClient from "./NavClient";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  let postEventHref = "/register";
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    role = data?.role ?? null;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    postEventHref = membership ? "/events/new" : "/become-organizer";
  }

  return (
    <nav className="bg-navy border-b border-cream/10 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center hover:opacity-80 transition">
          <Image
            src="/logo.png"
            alt="litly"
            width={56}
            height={56}
            className="rounded-xl"
            priority
          />
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/events">Events</NavLink>
          <Link
            href="/events/map"
            className="bg-orange text-cream text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-orange/90 transition"
          >
            Map
          </Link>
          <NavLink href={postEventHref}>Post an event</NavLink>
          <NavLink href="/support">Support litly</NavLink>
        </div>

        {/* Auth controls + mobile menu (client) */}
        <NavClient user={user} role={role} postEventHref={postEventHref} />
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
