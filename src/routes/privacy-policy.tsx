import { createFileRoute } from "@tanstack/react-router";
import { supportEmail } from "@/lib/contact";
import { HomeLayout } from "@/components/home-layout";
import { getPageHead } from "@/lib/seo";
import { Link } from "fumadocs-core/link";
import { CookieSettingsButton } from "@/components/cookie-consent-banner";
import { buttonVariants } from "@/components/ui/button";

function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <article className="mx-auto prose max-w-prose">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong>{" "}
          <time dateTime="2026-11-23">November 23, 2026</time>
        </p>

        <p>
          This Privacy Policy explains what data{" "}
          <a href="https://skinsrestorer.net">skinsrestorer.net</a> processes,
          which services receive it, and what choices you have. The site has no
          user accounts. You can read the documentation and use the browser
          tools without signing in.
        </p>

        <h2>1. Information you provide</h2>
        <ul>
          <li>
            Skin images that you open, edit, upload, or generate in the Studio,
            upload, and generator tools
          </li>
          <li>Custom skin names, if you enter one</li>
          <li>MineSkin API keys, if you enter one</li>
          <li>
            Ratings and messages that you submit as documentation feedback
          </li>
          <li>Messages that you send to support by email or Discord</li>
        </ul>

        <h2>2. Hosting and request data</h2>
        <p>
          Cloudflare hosts the site. Every request goes through Cloudflare,
          which receives your IP address, the requested URL, and the headers
          your browser sends, such as its user agent and language. Cloudflare
          keeps request logs for us with details such as the URL, the time, and
          the response status.
        </p>
        <p>
          Cloudflare also adds its Web Analytics script to pages. The script
          sends page views and load times to Cloudflare without cookies. It runs
          whatever you choose in the analytics banner.
        </p>
        <p>
          The site has security rules, called a Content Security Policy, that
          tell your browser which scripts, images, and other content it may
          load. When your browser blocks something under these rules, it sends a
          report to skinsrestorer.net. The report names the page, the blocked
          address, and the rule, and can include your browser&apos;s user agent.
          The site removes the query string and fragment from every address in
          the report, because they can hold skin texture hashes, and then
          forwards the report to PostHog. The forwarded report does not contain
          your IP address. This happens whatever you choose in the analytics
          banner. We use these reports to find broken pages and injected
          content.
        </p>

        <h2>3. Analytics with your consent</h2>
        <p>
          The site asks before it starts analytics. Until you select{" "}
          <strong>Allow analytics</strong>, and after you select{" "}
          <strong>Decline</strong>, your browser does not load PostHog or Ahrefs
          and sends nothing to them. If Ahrefs already runs on the page when you
          decline, it stops on the next page load.
        </p>
        <p>
          If you allow analytics, your browser sends this data to PostHog
          through <code>t.skinsrestorer.net</code>, our address for PostHog EU
          Cloud:
        </p>
        <ul>
          <li>The pages you view, with the page address and referrer</li>
          <li>Clicks on links and buttons</li>
          <li>
            Actions in the tools, such as opening, saving, or exporting a skin
            in the Studio
          </li>
          <li>Your answer to the offer to switch the site language</li>
          <li>Documentation feedback that you submit</li>
          <li>
            Page performance, including which element made the page slow to
            respond or shift
          </li>
          <li>Your browser, operating system, device type, and screen size</li>
        </ul>
        <p>
          Before an event leaves your browser, the site removes skin texture
          hashes and editor handoff IDs from page addresses and other values.
        </p>
        <p>
          The site also loads Ahrefs Analytics, except on the Studio, upload,
          and generator pages. Ahrefs receives the address of each page you
          view, with skin texture hashes and handoff IDs removed, the referrer,
          and the addresses of links you click and forms you submit. If you go
          to a Studio page from another page, the site loads the Studio page
          again so that Ahrefs does not run on it.
        </p>

        <h2>4. Session recordings</h2>
        <p>
          If you allow analytics, PostHog records about 1 in 10 visits. A
          recording shows how the page looked and changed, with mouse movement,
          clicks, and scrolling. We use recordings to find layout problems and
          broken features.
        </p>
        <ul>
          <li>
            Text that you type into form fields is masked, so the recording does
            not contain it.
          </li>
          <li>
            The Studio editor panels, skin library, and skin gallery are left
            out of recordings.
          </li>
          <li>
            Skin texture hashes and handoff IDs are removed from every address
            in a recording, such as page addresses, links, and images.
          </li>
        </ul>

        <h2>5. Error reports</h2>
        <p>
          If you allow analytics, PostHog receives a report when a script error
          or an unhandled failure happens on a page. The report contains the
          error message, the stack trace, the page address, and your browser
          details. We use these reports to find and fix bugs.
        </p>

        <h2>6. How we use information</h2>
        <ul>
          <li>Serve the documentation and website content</li>
          <li>Process the uploads and generations that you start</li>
          <li>Operate, secure, debug, and improve the site</li>
          <li>Understand which documentation helps and where it falls short</li>
          <li>Answer support requests</li>
        </ul>

        <h2>7. Upload tools and MineSkin API keys</h2>
        <p>
          The Studio, upload, and generator tools run in your browser. Skins
          that you edit and save stay in your browser. A skin leaves your
          browser only when you generate a result. The{" "}
          <Link href="/cookie-policy">Cookie Policy</Link> describes that
          storage.
        </p>
        <p>
          When you generate a result, your browser sends the skin image, the
          model, and your optional name and cape choice straight to MineSkin. If
          you choose the Axolotl method with a cape, the browser sends them to
          SkinsRestorer Axolotl instead, which passes them to MineSkin. The
          files do not go through skinsrestorer.net.
        </p>
        <p>
          A MineSkin API key stays in the form on the page. The site sends it
          only to MineSkin, and only when you use the official MineSkin method
          or check cape access. It never sends the key to skinsrestorer.net or
          Axolotl, and it does not save the key in your browser.
        </p>
        <p>
          The reverse tool reads the file you select in your browser to find the
          texture URL inside it.
        </p>

        <h2>8. Services your browser contacts</h2>
        <p>
          Each of these services receives your IP address and browser details
          when your browser contacts it.
        </p>
        <ul>
          <li>
            Cloudflare, on every page, for hosting and Web Analytics (
            <code>static.cloudflareinsights.com</code> and{" "}
            <code>cloudflareinsights.com</code>)
          </li>
          <li>
            PostHog through <code>t.skinsrestorer.net</code>, only with your
            consent
          </li>
          <li>
            Ahrefs (<code>analytics.ahrefs.com</code>), only with your consent
            and not on the Studio, upload, and generator pages
          </li>
          <li>
            GitHub, on the home page, for team member avatars from{" "}
            <code>github.com</code> and{" "}
            <code>avatars.githubusercontent.com</code>
          </li>
          <li>
            Mojang (<code>textures.minecraft.net</code>), when the site shows a
            Minecraft skin or cape texture
          </li>
          <li>
            The SkinsRestorer skin gallery (
            <code>cool-skins.skinsrestorer.net</code>), when you open the
            gallery in the Studio
          </li>
          <li>
            MineSkin (<code>api.mineskin.org</code>) and SkinsRestorer Axolotl (
            <code>axolotl.skinsrestorer.net</code>), when you generate a result
            or check cape access
          </li>
          <li>
            Ko-fi (<code>ko-fi.com</code>) and NOWPayments (
            <code>nowpayments.io</code>), when you open their donation forms on
            the pricing page. A Ko-fi payment can open PayPal or Stripe.
          </li>
          <li>
            GitHub, Discord, Modrinth, SpigotMC, or bStats, when you follow a
            link to them
          </li>
        </ul>
        <p>These services handle the data under their own privacy policies.</p>

        <h2>9. International transfers</h2>
        <p>
          Some of these services run servers in other countries, including
          countries outside the European Economic Area. Your data can therefore
          be processed in a country with different data protection laws than
          yours. PostHog stores our analytics data in its EU Cloud.
        </p>

        <h2>10. Your rights</h2>
        <p>Depending on where you live, you can have the right to:</p>
        <ul>
          <li>Get a copy of the personal data we hold about you</li>
          <li>Correct or delete that data</li>
          <li>Object to or limit how we use it</li>
          <li>Receive it in a portable format</li>
          <li>
            Withdraw your analytics consent at any time, without affecting
            processing that happened before
          </li>
          <li>Complain to your local data protection authority</li>
        </ul>
        <p>
          To make a request, email{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>. The site has no
          accounts, so tell us which browser or session your request is about,
          if you know.
        </p>

        <h2>11. Your choices</h2>
        <ul>
          <li>
            Change your analytics choice at any time with the button below
          </li>
          <li>
            Skip the upload and generator tools if you do not want a skin sent
            to MineSkin
          </li>
          <li>Clear cookies and site data in your browser settings</li>
        </ul>
        <p>
          <CookieSettingsButton
            className={buttonVariants({ variant: "outline", size: "sm" })}
          />
        </p>

        <h2>12. Data retention</h2>
        <p>
          Data in your browser stays until you delete it or clear site data. The
          PostHog cookie expires after 365 days. Analytics events, recordings,
          error reports, and request logs stay with PostHog, Ahrefs, and
          Cloudflare for the retention period of each service. We keep support
          messages for as long as we need them to answer you.
        </p>

        <h2>13. Related policies</h2>
        <p>
          The <Link href="/cookie-policy">Cookie Policy</Link> lists every
          cookie and browser storage item the site uses.
        </p>

        <h2>14. Changes to this policy</h2>
        <p>
          When we change this Privacy Policy, we update the date at the top of
          this page.
        </p>
      </article>
    </div>
  );
}

export const Route = createFileRoute("/privacy-policy")({
  head: () =>
    getPageHead("/privacy-policy", {
      titleKey: "common.privacyPolicy",
      description:
        "What data skinsrestorer.net collects, including consent-based analytics and session recordings, and which services receive it.",
    }),
  component: () => (
    <HomeLayout>
      <PrivacyPolicyPage />
    </HomeLayout>
  ),
});
