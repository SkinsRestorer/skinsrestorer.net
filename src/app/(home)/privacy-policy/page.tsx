import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for skinsrestorer.net.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12">
      <article className="prose max-w-none dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong> March 21, 2026
        </p>

        <p>
          This Privacy Policy explains what information may be processed when
          you use <a href="https://skinsrestorer.net">skinsrestorer.net</a>.
          This site does not currently require user accounts to browse
          documentation or use its browser-based tools.
        </p>

        <h2>1. Information you provide</h2>
        <p>Depending on how you use the site, you may provide:</p>
        <ul>
          <li>Skin PNG files uploaded through the upload or generator tools</li>
          <li>Skin files opened in the reverse tool</li>
          <li>Optional custom skin names</li>
          <li>Optional MineSkin API keys entered into the browser UI</li>
          <li>Documentation feedback you choose to submit</li>
          <li>Information you send to support by email or Discord</li>
        </ul>

        <h2>2. Information collected automatically</h2>
        <p>
          We and our infrastructure providers may process technical data such
          as:
        </p>
        <ul>
          <li>IP address and request metadata needed to serve the site</li>
          <li>Browser and device information</li>
          <li>
            Usage analytics through PostHog if you accept analytics tracking
          </li>
          <li>SEO and traffic analytics collected through Ahrefs Analytics</li>
          <li>
            Browser storage used to remember things like docs feedback and
            preference state
          </li>
        </ul>

        <h2>3. How we use information</h2>
        <p>We use information to:</p>
        <ul>
          <li>Serve documentation and website content</li>
          <li>Process upload and generation requests you initiate</li>
          <li>Operate, secure, debug, and improve the site</li>
          <li>Understand documentation quality and site usage trends</li>
          <li>Respond to support requests</li>
        </ul>

        <h2>4. Upload tools and MineSkin API keys</h2>
        <p>
          The upload and generator pages run in your browser. When you submit a
          request, your selected file and related inputs are sent to the
          processing service you chose, such as MineSkin or SkinsRestorer
          Axolotl.
        </p>
        <p>
          MineSkin API keys entered on the page are kept in browser state and
          used only for the request flow you trigger. This site does not
          intentionally store those API keys on its own servers.
        </p>
        <p>
          The reverse-file tool reads the selected file locally in your browser
          to extract the referenced texture URL.
        </p>

        <h2>5. When information is shared</h2>
        <p>
          Information may be shared with service providers as needed to operate
          the site:
        </p>
        <ul>
          <li>Vercel for hosting, delivery, and request handling</li>
          <li>PostHog for product analytics when you consent</li>
          <li>Ahrefs for SEO and traffic analytics</li>
          <li>
            MineSkin or SkinsRestorer Axolotl when you use upload features
          </li>
          <li>
            GitHub, Discord, or Modrinth when you follow outbound links or use
            those services directly
          </li>
        </ul>

        <h2>6. Your choices</h2>
        <ul>
          <li>
            You can decline analytics cookies in the site&apos;s consent banner
          </li>
          <li>
            You can avoid the upload tools if you do not want files processed
          </li>
          <li>
            You can clear browser cookies and local storage through your browser
            settings
          </li>
          <li>
            You can contact{" "}
            <a href="mailto:support@skinsrestorer.net">
              support@skinsrestorer.net
            </a>{" "}
            for privacy-related questions
          </li>
        </ul>

        <h2>7. Data retention</h2>
        <p>
          We keep data only for as long as needed for the purposes described
          above or as required by the third-party service handling the request.
          Data stored in your browser, such as local feedback state, remains
          until you clear it or overwrite it.
        </p>

        <h2>8. Related policies</h2>
        <p>
          For more detail about cookies and similar technologies, see our{" "}
          <Link href="/cookie-policy">Cookie Policy</Link>.
        </p>

        <h2>9. Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will revise the date at the top of this page.
        </p>
      </article>
    </main>
  );
}
