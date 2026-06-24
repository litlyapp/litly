import { LegalShell, Section, SubHead, Bullets } from "@/components/legal";

export const metadata = {
  title: "Privacy Policy — litly",
  description: "How litly collects, uses, and shares information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How litly collects, uses, and shares information."
      effectiveDate="June 18, 2026"
    >
      <Section n={1} title="Overview">
        <p>
          This Privacy Policy explains how litly (Chad Knuth, doing business as litly, &ldquo;litly,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, and shares information when you use
          thelitlyapp.com and our related services. By using litly, you agree to this Policy.
        </p>
      </Section>

      <Section n={2} title="Information We Collect">
        <SubHead>A. Account information</SubHead>
        <Bullets
          items={[
            "Name, email address, and password.",
            "Organizer or organization profile details, logo or banner images, and links.",
            "If you sign in with Google, basic Google account profile information.",
          ]}
        />
        <SubHead>B. Content you provide</SubHead>
        <Bullets
          items={[
            "Events you post (titles, descriptions, dates, venues, ticket links, reader or author info).",
            "Saved events, RSVPs, follows, and support or contact messages you send us.",
          ]}
        />
        <SubHead>C. Location information</SubHead>
        <Bullets
          items={[
            "Event addresses you enter, which we convert to map coordinates (geocoding) via OpenStreetMap / Nominatim.",
            <>
              If you use &ldquo;near me,&rdquo; your device&rsquo;s approximate location (with your
              browser&rsquo;s permission) to show nearby events. We do not store your personal location.
            </>,
          ]}
        />
        <SubHead>D. Technical information</SubHead>
        <Bullets
          items={[
            "Device type, IP address, and browser information.",
            "Limited, privacy-friendly analytics data (see Cookies & Analytics below).",
          ]}
        />
      </Section>

      <Section n={3} title="How We Use Information">
        <Bullets
          items={[
            "Operate, maintain, and improve the litly platform.",
            "Authenticate accounts and verify email addresses.",
            <>Display events publicly and power search, map, and &ldquo;near me&rdquo; features.</>,
            "Send transactional email (RSVP confirmations, organizer digests, service notices).",
            "Compile and publish event roundups and promote the literary community.",
            "Detect and prevent fraud, abuse, and security issues.",
            "Comply with legal obligations.",
          ]}
        />
      </Section>

      <Section n={4} title="Promotional Use of Public Content">
        <p>
          If you post public-facing content (such as event listings, organization names, or banner
          images), you grant litly permission to display and promote that content on the Platform,
          litly&rsquo;s official social media accounts, and litly&rsquo;s marketing materials and
          newsletters. You retain ownership; to request removal, email privacy@thelitlyapp.com. We never
          use private information (your email address, contact messages) in public marketing.
        </p>
      </Section>

      <Section n={5} title="How We Share Information">
        <p>We share limited information with service providers who help us operate litly:</p>
        <Bullets
          items={[
            <><strong className="text-cream">Hosting and database providers</strong> &mdash; to run the website, store data, host images, and provide cookieless usage analytics.</>,
            <><strong className="text-cream">Stripe</strong> &mdash; to process donations. Stripe receives payment details; litly does not store your card information.</>,
            <><strong className="text-cream">An email delivery provider</strong> &mdash; to send email and receive the newsletters litly subscribes to.</>,
            <><strong className="text-cream">OpenStreetMap / Nominatim</strong> &mdash; to display maps and convert addresses to coordinates.</>,
            <><strong className="text-cream">Law enforcement or authorities</strong> &mdash; if legally required.</>,
          ]}
        />
        <p>A current list of our service providers is available on request at privacy@thelitlyapp.com.</p>
        <p>
          <strong className="text-cream">
            We do not sell your personal information, and we do not use third-party advertising or
            tracking pixels.
          </strong>
        </p>
      </Section>

      <Section n={6} title="Cookies & Analytics">
        <p>
          litly uses only the cookies needed to run the service &mdash; for example, to keep you signed in
          and to remember preferences such as your active organization. We do not use advertising cookies
          or third-party tracking pixels.
        </p>
        <p>
          Our usage analytics are cookieless and do not track you across other websites.
        </p>
      </Section>

      <Section n={7} title="Data Retention">
        <p>
          We retain account and event data for as long as your account is active or as needed to provide
          the service and meet legal, accounting, or security obligations. During the beta phase, data may
          occasionally be reset as part of testing. You can delete your account at any time, which removes
          your personal account data and any organizations left without other members.
        </p>
      </Section>

      <Section n={8} title="Data Security">
        <p>
          We use HTTPS encryption, token-based authentication, row-level database security, signed
          uploads, and rate limiting to protect your information. No system is 100% secure; use litly at
          your own discretion.
        </p>
      </Section>

      <Section n={9} title="Children's Privacy">
        <p>
          litly is intended for users aged 16 and older and is not directed to children under 16. We do
          not knowingly collect personal information from children under 16. If you believe a child has
          provided us information, contact privacy@thelitlyapp.com and we will delete it.
        </p>
      </Section>

      <Section n={10} title="Your Rights">
        <p>Depending on where you live, you may:</p>
        <Bullets
          items={[
            "Access, correct, or delete your information.",
            "Request account deletion (also available in account settings).",
            "Opt out of marketing email (unsubscribe link in every marketing message).",
            "Request details on how your data is used.",
          ]}
        />
        <p>
          EU/UK (GDPR) and California (CCPA/CPRA) residents have additional rights, including the right to
          request a copy of their data and to lodge a complaint with a regulator. Email
          privacy@thelitlyapp.com for any request.
        </p>
      </Section>

      <Section n={11} title="Updates to This Policy">
        <p>
          We may update this Policy periodically. The latest version will always appear at
          thelitlyapp.com/privacy with its effective date.
        </p>
      </Section>

      <Section n={12} title="Contact">
        <p>
          For questions or privacy requests:{" "}
          <a href="mailto:privacy@thelitlyapp.com" className="text-orange hover:text-orange/80 hover:underline transition">
            privacy@thelitlyapp.com
          </a>
        </p>
      </Section>
    </LegalShell>
  );
}
