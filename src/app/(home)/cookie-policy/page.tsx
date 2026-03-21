import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Cookie Policy for skinsrestorer.net.",
};

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <article className="prose max-w-none dark:prose-invert">
        <h1>Cookie Policy</h1>
        <p>
          <strong>Last updated:</strong> March 21, 2026
        </p>

        <p>
          This Cookie Policy explains how skinsrestorer.net uses cookies and
          similar browser storage technologies.
        </p>

        <h2>1. What we use</h2>
        <p>
          The site may use cookies, local storage, and similar technologies to
          remember preferences, measure usage, and support site functionality.
        </p>

        <h2>2. Functional browser storage</h2>
        <p>We use browser storage for features such as:</p>
        <ul>
          <li>Remembering documentation feedback you already submitted</li>
          <li>Remembering interface preferences such as theme state</li>
        </ul>

        <h2>3. Analytics cookies</h2>
        <p>
          We use Google&apos;s Privacy &amp; Messaging tooling associated with
          our AdSense integration to gather consent where required and to expose
          privacy controls to users in supported regions.
        </p>
        <p>
          When Google&apos;s consent signal allows analytics storage, the site
          may use PostHog cookies and similar identifiers, including cookies
          with names prefixed by <code>ph_</code>, to understand how visitors
          use the site and documentation. When analytics storage is denied,
          PostHog is configured to stay in cookieless mode on reject, so PostHog
          cookies should not be used for site analytics.
        </p>

        <h2>4. SEO and performance analytics</h2>
        <p>
          The site also loads Ahrefs Analytics to monitor traffic and search
          performance. Ahrefs may process request metadata and may use its own
          cookies or similar technology under its own policies.
        </p>

        <h2>5. Third-party processing services</h2>
        <p>
          When you use upload-related features, your browser may communicate
          directly with MineSkin or SkinsRestorer Axolotl. Those services have
          their own privacy and cookie practices.
        </p>

        <h2>6. Managing cookies</h2>
        <ul>
          <li>
            Use the site&apos;s Privacy &amp; cookie settings entrypoint to
            review or change Google-managed consent choices when available
          </li>
          <li>Clear cookies and site storage in your browser settings</li>
          <li>
            Use browser privacy controls or extensions to block third-party
            scripts
          </li>
        </ul>

        <h2>7. More information</h2>
        <p>
          For more information about how information is processed on this site,
          read the <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
      </article>
    </main>
  );
}
