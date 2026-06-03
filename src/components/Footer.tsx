import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-cream-muted text-sm">
        <Link href="/" className="font-serif text-lg text-cream hover:text-orange transition">
          litly
        </Link>
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/events" className="hover:text-cream transition">Events</Link>
          <Link href="/events/map" className="hover:text-cream transition">Map</Link>
          <Link href="/register" className="hover:text-cream transition">Post an event</Link>
        </nav>
        <p className="text-cream-muted/50 text-xs">
          © {new Date().getFullYear()} litly
        </p>
      </div>
    </footer>
  );
}
