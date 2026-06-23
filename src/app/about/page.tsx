import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "About — litly",
  description:
    "litly helps readers discover literary events — readings, open mics, workshops, and craft talks — and helps bookstores, libraries, and organizers fill their rooms.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <header className="mb-12">
        <Image
          src="/logo.png"
          alt="litly"
          width={88}
          height={88}
          priority
          className="rounded-2xl mx-auto mb-6"
        />
        <h1 className="font-serif text-4xl sm:text-5xl text-cream mb-4">
          About litly
        </h1>
        <p className="text-cream-muted text-lg leading-relaxed">
          litly is a digital home for literary events. We bring readings, open
          mics, workshops, craft talks, book launches, and other literary
          gatherings into one place&mdash;searchable by genre, date, and
          location. Our goal is simple: to allow readers to find their next
          literary moment, anywhere and anytime.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">Our mission</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              Literary events are everywhere. They&rsquo;re scattered across
              bookstore calendars, library bulletins, organization newsletters,
              city-centered events pages, and a dozen ticketing platforms. A
              brilliant reading three blocks away goes unnoticed simply because
              no one knew it was happening.
            </p>
            <p>
              litly exists to fix that: to make literary events discoverable,
              and in doing so, to send more readers through the doors of the
              bookstores, libraries, and independent organizers who keep book
              culture alive.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">What we do</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              litly is an independent discovery platform&mdash;not an event
              organizer. We allow the space for organizers to post their own
              events directly, and gather literary events from publicly
              announced sources. Every listing links back to the organizer or
              venue, where you can RSVP or buy tickets directly from the source.
            </p>
            <ul className="list-disc pl-5 space-y-2 marker:text-orange">
              <li>
                <strong className="text-cream">Search &amp; filter</strong> by
                keyword, genre, event type, date, and location.
              </li>
              <li>
                <strong className="text-cream">Browse your way</strong> — as a
                list or on a map, with filters that carry across both.
              </li>
              <li>
                <strong className="text-cream">Save events</strong> to revisit,
                and follow the organizers you love.
              </li>
              <li>
                <strong className="text-cream">Post for free</strong> — any
                organizer can list their events at no cost.
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">
            Compiled with care
          </h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              Some listings are compiled from publicly announced sources, such
              as organization newsletters and public event announcements. Our
              team reviews these before they go live. Event information belongs
              to the organizers and venues who host these gatherings, and is
              shown to help people attend and support them.
            </p>
            <p>
              If you&rsquo;re an organizer and would like a compiled listing
              corrected or removed, just{" "}
              <a
                href="mailto:privacy@thelitlyapp.com"
                className="text-cream hover:text-orange transition"
              >
                email us
              </a>
              &mdash;we act on all reasonable requests promptly.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">Get started</h2>
          <div className="space-y-4 text-cream-muted leading-relaxed">
            <p>
              Ready to find your next literary moment? Browse what&rsquo;s
              happening, or put your own event on the map.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/events"
                className="bg-orange text-cream font-semibold px-5 py-2.5 rounded-full hover:bg-orange/90 transition text-sm"
              >
                Explore events
              </Link>
              <Link
                href="/events/map"
                className="border border-cream/20 text-cream font-semibold px-5 py-2.5 rounded-full hover:border-orange hover:text-orange transition text-sm"
              >
                Open the map
              </Link>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">Get in touch</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              Questions, suggestions, or just want to say hello? Reach us at{" "}
              <a
                href="mailto:privacy@thelitlyapp.com"
                className="text-cream hover:text-orange transition"
              >
                privacy@thelitlyapp.com
              </a>
              , or visit our{" "}
              <Link href="/support" className="text-cream hover:text-orange transition">
                support page
              </Link>
              .
            </p>
          </div>
        </section>
      </div>

      <nav className="mt-12 pt-6 border-t border-cream/10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/events" className="text-cream-muted hover:text-cream transition">Events</Link>
        <Link href="/terms" className="text-cream-muted hover:text-cream transition">Terms</Link>
        <Link href="/privacy" className="text-cream-muted hover:text-cream transition">Privacy</Link>
        <Link href="/" className="text-cream-muted hover:text-cream transition">&larr; Home</Link>
      </nav>
    </div>
  );
}
