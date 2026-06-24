import Link from "next/link";
import type { ReactNode } from "react";

/** Shared shell + primitives for the /terms and /privacy pages. */

export function LegalShell({
  title,
  subtitle,
  effectiveDate,
  children,
}: {
  title: string;
  subtitle?: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <header className="mb-10">
        <h1 className="font-serif text-4xl text-cream mb-3">{title}</h1>
        {subtitle && <p className="text-cream-muted leading-relaxed">{subtitle}</p>}
        <p className="text-cream-muted/60 text-sm mt-4">Effective date: {effectiveDate}</p>
        <p className="text-cream-muted/60 text-sm">
          Operated by Chad Knuth, doing business as litly.
        </p>
      </header>

      <div className="space-y-8">{children}</div>

      <nav className="mt-12 pt-6 border-t border-cream/10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/terms" className="text-cream-muted hover:text-cream transition">Terms</Link>
        <Link href="/privacy" className="text-cream-muted hover:text-cream transition">Privacy</Link>
        <Link href="/" className="text-cream-muted hover:text-cream transition">&larr; Home</Link>
      </nav>
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-2xl text-cream mb-3">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-cream-muted leading-relaxed">{children}</div>
    </section>
  );
}

export function SubHead({ children }: { children: ReactNode }) {
  return <h3 className="font-semibold text-cream mt-4 mb-1">{children}</h3>;
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 marker:text-orange">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}
