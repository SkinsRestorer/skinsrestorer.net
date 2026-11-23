import { createFileRoute } from "@tanstack/react-router";
import { supportEmail } from "@/lib/contact";
import { HomeLayout } from "@/components/home-layout";
import { getPageHead } from "@/lib/seo";
import { Link } from "fumadocs-core/link";
import { CookieSettingsButton } from "@/components/cookie-consent-banner";
import { buttonVariants } from "@/components/ui/button";

function CookiePolicyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <article className="mx-auto prose max-w-prose">
        <h1>Cookie Policy</h1>
        <p>
          <strong>Last updated:</strong>{" "}
          <time dateTime="2026-11-23">November 23, 2026</time>
        </p>

        <p>
          This Cookie Policy lists the cookies and browser storage that
          skinsrestorer.net uses, what each item holds, and how long it stays.
        </p>

        <h2>1. Storage the site needs</h2>
        <p>
          The site saves these items in your browser so that its features work.
          They do not depend on your analytics choice. The site reads them only
          in your browser and does not send them to us.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Where</th>
              <th scope="col">What it holds</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>skinsrestorer:analytics-consent</code>
              </td>
              <td>Local storage</td>
              <td>
                Your choice in the analytics banner: <code>1</code> if you
                allowed analytics, <code>0</code> if you declined
              </td>
            </tr>
            <tr>
              <td>
                <code>theme</code>
              </td>
              <td>Local storage</td>
              <td>Your light, dark, or system theme</td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer:language-suggestion</code>
              </td>
              <td>Local storage</td>
              <td>
                Your answer to the offer to show the site in your browser&apos;s
                language, so the offer shows only once
              </td>
            </tr>
            <tr>
              <td>
                <code>docs-feedback-</code> followed by the documentation
                version and page
              </td>
              <td>Local storage</td>
              <td>
                The rating and message you gave on a documentation page, so the
                page can show them again
              </td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer-skins</code>
              </td>
              <td>IndexedDB</td>
              <td>
                Your Studio skin library: the skins you save, with their names
                and images, and your unsaved editor work, so you can recover it
                after a reload
              </td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer:editor-recent-colors</code>
              </td>
              <td>Local storage</td>
              <td>Up to 8 colors you used recently in the Studio editor</td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer:editor:draft</code>
              </td>
              <td>Local storage</td>
              <td>
                An editor draft saved by an older version of the site. The
                Studio moves it into your skin library and then deletes it.
              </td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer:editor:handoff</code>
              </td>
              <td>Session storage</td>
              <td>
                A one-time skin snapshot from an older editor link. The Studio
                reads it when you open that link.
              </td>
            </tr>
            <tr>
              <td>
                <code>skinsrestorer:stale-chunk-reload</code>
              </td>
              <td>Session storage</td>
              <td>
                The time the site last reloaded itself after an update, so it
                reloads at most once a minute
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Session storage clears when you close the tab. Local storage and
          IndexedDB stay until you delete the item in the Studio or clear site
          data in your browser.
        </p>

        <h2>2. Analytics cookies</h2>
        <p>
          The site sets analytics cookies only after you select{" "}
          <strong>Allow analytics</strong>. PostHog then saves a cookie, a local
          storage entry, and a session storage entry named <code>ph_</code>{" "}
          followed by the project token and <code>_posthog</code>. They hold a
          random visitor ID and the current session, so PostHog can connect the
          pages you view during a visit. The cookie expires after 365 days.
          Ahrefs Analytics, which also loads, handles your visit under the{" "}
          <a href="https://ahrefs.com/privacy">Ahrefs privacy policy</a>.
        </p>
        <p>
          If you decline later, PostHog stops and deletes its cookie and storage
          entries at once. If Ahrefs already runs on the page, the site reloads
          the page to stop it.
        </p>
        <p>
          Cloudflare Web Analytics counts page views and load times without
          cookies, whatever you choose.
        </p>

        <h2>3. Third-party content</h2>
        <p>
          The Ko-fi and NOWPayments donation forms on the pricing page load only
          when you open them, and can set their own cookies under their own
          policies. A Ko-fi payment can open PayPal or Stripe. The{" "}
          <Link href="/privacy-policy">Privacy Policy</Link> lists every service
          your browser contacts.
        </p>

        <h2>4. Managing cookies</h2>
        <ul>
          <li>
            Change your analytics choice at any time with the button below
          </li>
          <li>Delete saved skins in the Studio skin library</li>
          <li>Clear cookies and site data in your browser settings</li>
          <li>Block third-party scripts with browser privacy controls</li>
        </ul>
        <p>
          <CookieSettingsButton
            className={buttonVariants({ variant: "outline", size: "sm" })}
          />
        </p>

        <h2>5. More information</h2>
        <p>
          The <Link href="/privacy-policy">Privacy Policy</Link> explains what
          data the site processes and why. For questions, contact{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </p>
      </article>
    </div>
  );
}

export const Route = createFileRoute("/cookie-policy")({
  head: () =>
    getPageHead("/cookie-policy", {
      titleKey: "common.cookiePolicy",
      description:
        "The cookies and browser storage skinsrestorer.net uses for analytics, the Studio skin library, and saved preferences.",
    }),
  component: () => (
    <HomeLayout>
      <CookiePolicyPage />
    </HomeLayout>
  ),
});
