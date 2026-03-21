import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for skinsrestorer.net.",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <article className="prose max-w-none dark:prose-invert">
        <h1>Terms of Service</h1>
        <p>
          <strong>Last updated:</strong> March 21, 2026
        </p>

        <p>
          These Terms of Service govern your use of{" "}
          <a href="https://skinsrestorer.net">skinsrestorer.net</a> and the
          tools, documentation, and related resources made available through the
          site.
        </p>

        <h2>1. Agreement to these terms</h2>
        <p>
          By accessing or using this website, you agree to these terms. If you
          do not agree, do not use the site.
        </p>

        <h2>2. What this website provides</h2>
        <p>The site currently provides:</p>
        <ul>
          <li>Documentation for the SkinsRestorer project</li>
          <li>
            Browser-based helpers for skin uploads and custom skin generation
          </li>
          <li>
            Links to project resources such as GitHub, Discord, and Modrinth
          </li>
        </ul>

        <h2>3. Acceptable use</h2>
        <p>You agree not to use the site or its tools to:</p>
        <ul>
          <li>Violate applicable law or another party&apos;s rights</li>
          <li>Upload malicious, infringing, or unauthorized content</li>
          <li>Interfere with the site, its infrastructure, or upstream APIs</li>
          <li>
            Scrape, abuse, or automate access in a way that creates excessive
            load
          </li>
          <li>Misrepresent your relationship with the SkinsRestorer project</li>
        </ul>

        <h2>4. Uploaded content and API keys</h2>
        <p>
          If you upload skin files, submit custom names, or enter a MineSkin API
          key, you represent that you have the right to use that content or
          credential for the requested action.
        </p>
        <p>
          The upload and generator tools may send your file and related inputs
          to the selected processing service, such as MineSkin or SkinsRestorer
          Axolotl, in order to produce the requested result.
        </p>

        <h2>5. Third-party services</h2>
        <p>
          This site depends on or links to third-party services including
          MineSkin, SkinsRestorer Axolotl, GitHub, Discord, Modrinth, Vercel,
          PostHog, and Ahrefs. Those services operate under their own terms and
          privacy policies, and we are not responsible for their content,
          uptime, or practices.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          SkinsRestorer and its website content remain the property of their
          respective owners and contributors, except where open-source licenses
          or third-party rights apply. Uploading a file does not transfer your
          ownership to us.
        </p>

        <h2>7. Disclaimers and limitation of liability</h2>
        <p>
          The site is provided on an &quot;as is&quot; and &quot;as
          available&quot; basis, without warranties of any kind. To the maximum
          extent permitted by law, SkinsRestorer and its contributors are not
          liable for indirect, incidental, special, consequential, or punitive
          damages arising from your use of the site or its third-party
          integrations.
        </p>

        <h2>8. Related policies</h2>
        <p>
          Your use of the site is also subject to our{" "}
          <Link href="/privacy-policy">Privacy Policy</Link> and{" "}
          <Link href="/cookie-policy">Cookie Policy</Link>.
        </p>

        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. When we do, we will
          revise the date at the top of this page.
        </p>

        <h2>10. Contact</h2>
        <p>
          For questions about these terms, contact{" "}
          <a href="mailto:support@skinsrestorer.net">
            support@skinsrestorer.net
          </a>{" "}
          or reach out through <a href="/discord">Discord</a>.
        </p>
      </article>
    </main>
  );
}
