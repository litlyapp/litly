import Link from "next/link";
import { STRIPE_LINKS } from "@/lib/stripeLinks";

export const metadata = {
  title: "Support litly",
  description: "Help keep litly free and independent.",
};

export default function SupportPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl text-cream mb-4">Support litly</h1>
        <p className="text-cream-muted leading-relaxed">
          litly is a free, independent tool built to make literary events
          easier to find—no algorithms, no ads, just a place where readers
          and writers can find each other.
        </p>
        <p className="text-cream-muted leading-relaxed mt-4">
          If litly has helped you discover a reading, follow a series, or share
          your events with new audiences, consider contributing to keep it
          running and growing.
        </p>
      </div>

      {/* Preset amounts */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {([5, 10, 25] as const).map((amount) => (
          <a
            key={amount}
            href={STRIPE_LINKS[amount]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center bg-navy-light border border-cream/20 rounded-2xl py-5 hover:border-orange/50 hover:bg-navy transition group"
          >
            <span className="font-serif text-2xl text-cream group-hover:text-orange transition">
              ${amount}
            </span>
          </a>
        ))}
      </div>

      {/* Custom amount */}
      <a
        href={STRIPE_LINKS.custom}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center bg-orange text-cream font-semibold py-3 rounded-full hover:bg-orange/90 transition mb-8"
      >
        Choose your own amount
      </a>

      <p className="text-cream-muted/50 text-xs text-center">
        Payments are processed securely by Stripe. litly does not store your payment details.
      </p>

      <div className="mt-10 text-center">
        <Link href="/events" className="text-cream-muted text-sm hover:text-cream transition">
          ← Back to events
        </Link>
      </div>
    </div>
  );
}
