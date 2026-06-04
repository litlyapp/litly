import Link from "next/link";
import Image from "next/image";
import InstallButton from "./InstallButton";

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-cream-muted text-sm">
        <Link href="/" className="flex items-center hover:opacity-80 transition">
          <Image src="/logo.png" alt="litly" width={48} height={48} className="rounded-xl" />
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/events" className="hover:text-cream transition">Events</Link>
          <Link href="/events/map" className="hover:text-cream transition">Map</Link>
          <Link href="/register" className="hover:text-cream transition">Post an event</Link>
          <InstallButton variant="footer" />
        </nav>
        <p className="text-cream-muted/50 text-xs">
          © {new Date().getFullYear()} litly
        </p>
      </div>
    </footer>
  );
}
