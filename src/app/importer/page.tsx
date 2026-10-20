import Link from "next/link";
import { IMPORTER_USER_AGENT, KEY_DIRECTORY_PATH } from "@/lib/webBotAuth";
import { IMPORTER_ROBOTS_TOKEN } from "@/lib/robots";

export const metadata = {
  title: "litly importer — litly",
  description:
    "What litly's event importer is, what it fetches, how it identifies itself, and how site owners can opt out.",
};

export default function ImporterPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <header className="mb-12">
        <h1 className="font-serif text-4xl sm:text-5xl text-cream mb-4">litly importer</h1>
        <p className="text-cream-muted text-lg leading-relaxed">
          If you run a website and see <code className="text-cream">litly-importer</code> in your
          logs, this page explains what it is.
        </p>
      </header>

      <div className="space-y-10">
        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">What it does</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              litly is a free site that helps readers find literary events. When an organizer adds
              an event, they can paste a link to the event&rsquo;s page and litly pre-fills the
              listing for them to review before it&rsquo;s published.
            </p>
            <p>
              Each fetch is <strong className="text-cream">one page that a person submitted</strong>,
              made at the moment they submit it. The importer doesn&rsquo;t crawl, follow links,
              index sites, or collect content for AI training. Listings credit the original source
              and link back to it.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">How it identifies itself</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>Every request carries this user agent:</p>
            <pre className="bg-navy-light border border-cream/10 rounded-xl p-4 text-cream text-sm overflow-x-auto">
              {IMPORTER_USER_AGENT}
            </pre>
            <p>
              Requests are also signed with{" "}
              <a
                href="https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/"
                className="text-orange hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Web Bot Auth
              </a>{" "}
              (HTTP Message Signatures). Our public keys are published at{" "}
              <a href={KEY_DIRECTORY_PATH} className="text-orange hover:underline break-all">
                thelitlyapp.com{KEY_DIRECTORY_PATH}
              </a>
              .
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">Opting out</h2>
          <div className="space-y-3 text-cream-muted leading-relaxed">
            <p>
              The importer checks your <code className="text-cream">robots.txt</code> before each
              fetch. To stop it reading your pages, add:
            </p>
            <pre className="bg-navy-light border border-cream/10 rounded-xl p-4 text-cream text-sm overflow-x-auto">
              {`User-agent: ${IMPORTER_ROBOTS_TOKEN}\nDisallow: /`}
            </pre>
            <p>
              It also follows rules you set for all bots (<code className="text-cream">User-agent: *</code>).
              When a page is off-limits, organizers are asked to copy the event details themselves
              instead.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-cream mb-3">Contact</h2>
          <p className="text-cream-muted leading-relaxed">
            Questions or concerns? Email{" "}
            <a href="mailto:admin@thelitlyapp.com" className="text-orange hover:underline">
              admin@thelitlyapp.com
            </a>
            . More about litly is on our <Link href="/about" className="text-orange hover:underline">about page</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
