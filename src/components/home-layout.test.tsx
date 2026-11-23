import assert from "node:assert/strict";
import { test } from "bun:test";
import { FrameworkProvider } from "fumadocs-core/framework";
import { RootProvider } from "fumadocs-ui/provider/base";
import { renderToStaticMarkup } from "react-dom/server";
import { fumadocsMessages } from "@/lib/messages/fumadocs";
import { HomeLayout } from "./home-layout";

const navigation = { push: () => {}, refresh: () => {} };

function render(pathname = "/") {
  return renderToStaticMarkup(
    <FrameworkProvider
      usePathname={() => pathname}
      useParams={() => ({})}
      useRouter={() => navigation}
    >
      <RootProvider
        search={{ enabled: false }}
        i18n={{ locale: "en", translations: fumadocsMessages("en") }}
      >
        <HomeLayout>
          <h1>Page content</h1>
        </HomeLayout>
      </RootProvider>
    </FrameworkProvider>,
  );
}

test("the header, main content, and footer are separate top-level landmarks", () => {
  const html = render();
  const landmarks = [
    ...html.matchAll(/<\/?(header|main|footer)\b[^>]*>/gu),
  ].map((match) => `${match[0].replace(/\s.*$/u, "").replace(/>$/u, "")}>`);

  assert.deepEqual(landmarks, [
    "<header>",
    "</header>",
    "<main>",
    "</main>",
    "<footer>",
    "</footer>",
  ]);
});

test("the skip link targets the focusable main landmark that holds the page", () => {
  const html = render();
  const skipLink = /<a[^>]*href="#main-content"[^>]*>([^<]*)<\/a>/u.exec(html);
  assert.equal(skipLink?.[1], "Skip to content");

  const main = /<main([^>]*)>([\s\S]*)<\/main>/u.exec(html);
  assert.ok(main?.[1]?.includes('id="main-content"'));
  assert.ok(main?.[1]?.includes('tabindex="-1"'));
  assert.equal(main?.[2], "<h1>Page content</h1>");
});

test("the language switch shows on translated pages and hides on English-only policies", () => {
  const languageSwitch = /aria-label="[^"]*Choose a language"/u;
  for (const path of ["/", "/es/pricing"])
    assert.match(render(path), languageSwitch, path);
  for (const path of ["/privacy-policy", "/terms-of-service", "/cookie-policy"])
    assert.doesNotMatch(render(path), languageSwitch, path);
});
