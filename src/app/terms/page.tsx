import { LegalShell, Section, Bullets } from "@/components/legal";

export const metadata = {
  title: "Terms & Conditions — litly",
  description: "The terms that govern your use of litly.",
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms & Conditions"
      subtitle="These terms govern your use of litly. Please read them carefully."
      effectiveDate="June 18, 2026"
    >
      <Section n={1} title="Introduction">
        <p>
          Welcome to litly, a platform for discovering literary events &mdash; readings, open mics,
          workshops, craft talks, and more &mdash; searchable by genre, date, and map. These Terms &amp;
          Conditions (&ldquo;Terms&rdquo;) govern your use of the litly website, installable app, and
          related services (collectively, the &ldquo;Platform&rdquo;), operated by Chad Knuth, doing
          business as litly (&ldquo;litly,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
        </p>
        <p>
          By accessing or using the Platform, you agree to these Terms and to our Privacy Policy. If you
          do not agree, please discontinue use.
        </p>
      </Section>

      <Section n={2} title="Beta Notice">
        <p>litly is under active development. You understand that:</p>
        <Bullets
          items={[
            "Features and functionality may change without notice.",
            "The Platform may experience downtime, bugs, or data loss.",
            "Access may be limited or revoked at any time.",
            <>The service is provided &ldquo;as is&rdquo; with no warranties during this phase.</>,
          ]}
        />
      </Section>

      <Section n={3} title="Eligibility">
        <p>
          You must be at least 16 years old to use the Platform, and at least 18 (or the age of majority
          where you live) to create an organizer account or make donations. By using the Platform you
          represent that you meet these requirements.
        </p>
      </Section>

      <Section n={4} title="User Accounts">
        <Bullets
          items={[
            "You are responsible for all activity under your account and for keeping your credentials secure.",
            "You must provide accurate information and keep it current.",
            <>
              <strong className="text-cream">Email verification.</strong> You must verify your email
              address before accessing account features such as saving events, RSVPing, following
              organizers, or posting events. A verification link is sent at registration and expires
              after 24 hours; it can be resent from the verification screen. Users who sign in with
              Google are automatically verified.
            </>,
            "We may suspend or terminate accounts for policy violations, fraudulent activity, or misuse.",
          ]}
        />
      </Section>

      <Section n={5} title="Organizers & Event Listings">
        <p>
          Organizers may post and manage events, optionally as part of a multi-member organization with
          admin and editor roles. If you post an event, you represent that:
        </p>
        <Bullets
          items={[
            "You have the right to publish the event details, images, and any reader or author information you include.",
            "The information is accurate to the best of your knowledge, and you will update or cancel listings that change.",
            "Your content does not infringe others’ rights or violate any law.",
          ]}
        />
        <p>
          You grant litly a non-exclusive, worldwide, royalty-free license to display, reproduce, and
          promote the event content you submit, on the Platform and in litly&rsquo;s own marketing (for
          example, social media, newsletters, and event roundups). You retain ownership of your content.
          To request removal of a listing or image, contact privacy@thelitlyapp.com.
        </p>
      </Section>

      <Section n={6} title="Listings Compiled from Public Sources">
        <p>
          Some events shown on litly are compiled from publicly announced sources &mdash; for example,
          organization newsletters and public event announcements. Our team reviews these listings before
          publishing. If you are an organizer and would like a compiled listing corrected or removed,
          email privacy@thelitlyapp.com and we will act on reasonable requests promptly.
        </p>
      </Section>

      <Section n={7} title="Accuracy Disclaimer">
        <p>
          Event details on litly come from organizers and third-party sources and may contain errors or
          become outdated. We provide no warranty as to the accuracy, completeness, timeliness, or
          availability of any listing.{" "}
          <strong className="text-cream">
            Always confirm date, time, location, ticketing, and any age or access requirements directly
            with the organizer before attending.
          </strong>{" "}
          litly is not the organizer of listed events, does not sell tickets, and is not responsible for
          events that are changed, cancelled, sold out, or misrepresented.
        </p>
      </Section>

      <Section n={8} title="Donations">
        <p>
          litly accepts voluntary donations through Stripe-hosted payment links. Donations are processed
          by Stripe; litly does not collect or store your card details. Donations are generally
          non-refundable except where required by law &mdash; contact us with any billing concern.
        </p>
      </Section>

      <Section n={9} title="Acceptable Use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Post false, misleading, infringing, harassing, or unlawful content.",
            "Post events you are not authorized to publish, or spam or duplicate listings.",
            "Attempt to gain unauthorized access to accounts, data, or systems.",
            "Interfere with the Platform’s operation or security controls.",
          ]}
        />
      </Section>

      <Section n={10} title="No Scraping or AI Training on litly Content">
        <p>
          You may not copy, scrape, or harvest the Platform or its content &mdash; including listings,
          compilations, and organizer data &mdash; to create competing products or to train artificial
          intelligence tools or models, without our prior written permission.
        </p>
      </Section>

      <Section n={11} title="Intellectual Property">
        <p>
          The litly name, logo, design, and software are owned by or licensed to litly and protected by
          applicable law. Except for content you submit, nothing in these Terms grants you rights in
          litly&rsquo;s intellectual property.
        </p>
      </Section>

      <Section n={12} title="Disclaimers & Limitation of Liability">
        <p>
          The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
          of any kind. To the maximum extent permitted by law, litly is not liable for indirect,
          incidental, or consequential damages, or for any loss arising from your use of the Platform,
          attendance at listed events, or reliance on listing information. No system is fully secure; you
          use the Platform at your own discretion.
        </p>
      </Section>

      <Section n={13} title="Termination">
        <p>
          You may delete your account at any time from your account settings. We may suspend or terminate
          access for violations of these Terms. Certain provisions (ownership, disclaimers, limitation of
          liability) survive termination.
        </p>
      </Section>

      <Section n={14} title="Governing Law & Disputes">
        <p>
          These Terms are governed by the laws of the State of North Carolina, without regard to
          conflict-of-law rules. Before filing any claim, you agree to first contact us at
          privacy@thelitlyapp.com so we can try to resolve the matter informally. Any dispute that cannot
          be resolved informally will be subject to the exclusive jurisdiction of the state and federal
          courts located in North Carolina.
        </p>
      </Section>

      <Section n={15} title="Changes to These Terms">
        <p>
          We may update these Terms periodically. The current version will always be posted at
          thelitlyapp.com/terms with its effective date. Continued use after changes means you accept
          them.
        </p>
      </Section>

      <Section n={16} title="Contact">
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:privacy@thelitlyapp.com" className="text-orange hover:text-orange/80 hover:underline transition">
            privacy@thelitlyapp.com
          </a>
        </p>
      </Section>
    </LegalShell>
  );
}
