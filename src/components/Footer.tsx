import Link from "next/link";
import Image from "next/image";
import InstallButton from "./InstallButton";
import { createClient } from "@/lib/supabase/server";

export default async function Footer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let postEventHref = "/register";
  if (user) {
    const { data } = await supabase
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    postEventHref = data ? "/events/new" : "/become-organizer";
  }

  return (
    <footer className="border-t border-cream/10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-cream-muted text-sm">
        <Link href="/" className="flex items-center hover:opacity-80 transition">
          <Image src="/logo.png" alt="litly" width={48} height={48} className="rounded-xl" />
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/events" className="hover:text-cream transition">Events</Link>
          <Link href="/events/map" className="hover:text-cream transition">Map</Link>
          <Link href="/events/calendar" className="hover:text-cream transition">Calendar</Link>
          <Link href={postEventHref} className="hover:text-cream transition">Post an event</Link>
          <Link href="/support" className="hover:text-cream transition">Support litly</Link>
          <Link href="/about" className="hover:text-cream transition">About</Link>
          <Link href="/terms" className="hover:text-cream transition">Terms</Link>
          <Link href="/privacy" className="hover:text-cream transition">Privacy</Link>
          <InstallButton variant="footer" />
        </nav>
        <p className="text-cream-muted/50 text-xs">
          © {new Date().getFullYear()} litly
        </p>
      </div>
    </footer>
  );
}
