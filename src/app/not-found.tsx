import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 py-32 text-center">
      <p className="font-serif text-8xl text-orange mb-4">404</p>
      <h1 className="font-serif text-3xl text-cream mb-3">Page not found</h1>
      <p className="text-cream-muted mb-8">
        This page doesn&apos;t exist — or the event may have been removed.
      </p>
      <div className="flex justify-center gap-3">
        <Link
          href="/events"
          className="bg-orange text-cream font-semibold px-6 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
        >
          Browse events
        </Link>
        <Link
          href="/"
          className="border border-cream/25 text-cream px-6 py-2.5 rounded-full hover:border-cream/50 transition text-sm"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
