import assert from "node:assert/strict";
import { mock, test } from "bun:test";
import { FrameworkProvider } from "fumadocs-core/framework";
import { RootProvider } from "fumadocs-ui/provider/base";
import { renderToStaticMarkup } from "react-dom/server";

// Bun keeps module mocks for later test files, so keep every real export.
const router = await import("@tanstack/react-router");
void mock.module("@tanstack/react-router", () => ({
  ...router,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname: "/" } }),
}));

const { HomeLayout } = await import("./home-layout");
const { fumadocsMessages } = await import("@/lib/messages/fumadocs");

const navigation = { push: () => {}, refresh: () => {} };

function render() {
  return renderToStaticMarkup(
    <FrameworkProvider
      usePathname={() => "/"}
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
