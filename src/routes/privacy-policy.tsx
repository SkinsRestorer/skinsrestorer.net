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
          <li>Custom skin names and MineSkin API keys, if you enter them</li>
          <li>
            Ratings and messages that you submit as documentation feedback
          </li>
          <li>Messages that you send to support by email or Discord</li>
        </ul>

        <h2>2. Hosting and security</h2>
        <p>
          Cloudflare hosts the site and receives every request, with your IP
          address, the requested URL, and the headers your browser sends, such
          as its user agent and language. Cloudflare keeps request logs for us.
          It also adds its Web Analytics script to pages, which sends page views
          and load times to Cloudflare without cookies.
        </p>
        <p>
          The site&apos;s Content Security Policy tells your browser which
          content it may load. When your browser blocks something, it sends a
          report to skinsrestorer.net with the page, the blocked address, the
          rule, and your user agent. The site removes query strings and
          fragments from the addresses and forwards the report to PostHog
          without your IP address. We use these reports to find broken pages and
          injected content.
        </p>
        <p>
          Cloudflare Web Analytics and these reports do not depend on your
          choice in the analytics banner.
        </p>

        <h2>3. Analytics with your consent</h2>
        <p>
          Until you select <strong>Allow analytics</strong>, and after you
          select <strong>Decline</strong>, your browser does not load PostHog or
          Ahrefs and sends nothing to them. If Ahrefs already runs on the page
          when you decline, the site reloads the page to stop it.
        </p>
        <p>
          If you allow analytics, your browser sends this data to PostHog EU
          Cloud through <code>t.skinsrestorer.net</code>:
        </p>
        <ul>
          <li>The pages you view, with the page address and referrer</li>
          <li>Clicks on links and buttons</li>
          <li>
            Actions in the tools, such as opening, saving, or exporting a skin
            in the Studio
          </li>
          <li>
            Your answer to the offer to switch the site language, and
            documentation feedback that you submit
          </li>
          <li>
            Page performance, including which element made the page slow to
            respond or shift
          </li>
          <li>
            Script errors, with the error message, stack trace, and page address
          </li>
          <li>Your browser, operating system, device type, and screen size</li>
        </ul>
        <p>
          PostHog also records about 1 in 10 visits: how the page looked and
          changed, with mouse movement, clicks, and scrolling. Recordings mask
          the text you type into form fields and leave out the Studio editor
          panels, skin library, and skin gallery.
        </p>
        <p>
          Ahrefs Analytics receives the address of each page you view, the
          referrer, and the addresses of links you click and forms you submit.
          It does not run on the Studio, upload, and generator pages. If you go
          to one of them from another page, the site loads it again without
          Ahrefs.
        </p>
        <p>
          Before any of this data leaves your browser, the site removes skin
          texture hashes from addresses and other values. You can change your
          choice at any time:
        </p>
        <p>
          <CookieSettingsButton
            className={buttonVariants({ variant: "outline", size: "sm" })}
          />
        </p>

        <h2>4. Studio tools and MineSkin API keys</h2>
        <p>
          The Studio, upload, and generator tools run in your browser. Skins
          that you edit and save stay in your browser storage, which the{" "}
          <Link href="/cookie-policy">Cookie Policy</Link> describes. The
          reverse tool reads the file you select only in your browser.
        </p>
        <p>
          When you generate a result, your browser sends the skin image, the
          model, and your optional name and cape choice straight to MineSkin.
          With the Axolotl method and a cape, it sends them to SkinsRestorer
          Axolotl instead, which passes them to MineSkin. The files do not go
          through skinsrestorer.net.
        </p>
        <p>
          The site sends a MineSkin API key only to MineSkin, and only when you
          use the official MineSkin method or check cape access. It does not
          save the key or send it anywhere else.
        </p>

        <h2>5. Services your browser contacts</h2>
        <p>
          Each of these services receives your IP address and browser details
          when your browser contacts it, and handles the data under its own
          privacy policy.
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
            <code>nowpayments.io</code>), only after you open their donation
            forms on the pricing page. A Ko-fi payment can open PayPal or
            Stripe.
          </li>
          <li>
            GitHub, Discord, Modrinth, SpigotMC, or bStats, when you follow a
            link to them
          </li>
        </ul>

        <h2>6. Why we process data</h2>
        <ul>
          <li>
            To serve the site, process the uploads and generations you start,
            and keep the site secure and working. This is our legitimate
            interest in running the site.
          </li>
          <li>
            To understand which pages and documentation help and where they fall
            short, with PostHog and Ahrefs. This is based on your consent.
          </li>
          <li>To answer support requests that you send.</li>
        </ul>

        <h2>7. International transfers</h2>
        <p>
          Some of these services run servers outside the European Economic Area,
          so your data can be processed in a country with different data
          protection laws than yours. PostHog stores our analytics data in its
          EU Cloud.
        </p>

        <h2>8. Data retention</h2>
        <p>
          Data in your browser stays until you delete it or clear site data. The
          PostHog cookie expires after 365 days. Analytics events, recordings,
          error reports, and request logs stay with PostHog, Ahrefs, and
          Cloudflare for the retention period of each service. We keep support
          messages for as long as we need them to answer you.
        </p>

        <h2>9. Your rights</h2>
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

        <h2>10. Changes to this policy</h2>
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
