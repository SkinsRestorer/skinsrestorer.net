import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { LocaleContext } from "@/lib/i18n-react";
import type { Locale } from "@/lib/i18n";
import { getLinkTarget } from "@/lib/link-target";
import { LocaleLink } from "./locale-link";

async function render(
  href: string,
  locale: Locale = "en",
  props: Omit<React.ComponentProps<typeof LocaleLink>, "href"> = {},
) {
  const rootRoute = createRootRoute();
  const docsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => (
      <LocaleContext value={locale}>
        <LocaleLink href={href} {...props}>
          Link
        </LocaleLink>
      </LocaleContext>
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([docsRoute]),
    history: createMemoryHistory({ initialEntries: ["/docs/current?tab=a"] }),
  });
  await router.load();
  const html = renderToString(<RouterProvider router={router} />);
  const anchor = /<a\b[^>]*>/u.exec(html)?.[0] ?? "";
  return {
    router,
    href: /href="([^"]*)"/u.exec(anchor)?.[1]?.replaceAll("&amp;", "&"),
    current: anchor.includes('aria-current="page"'),
  };
}

test("a fragment link keeps its fragment and does not mark the page current", async () => {
  const link = await render("#privacy");
  assert.equal(link.href, "#privacy");
  assert.equal(link.current, false);
});

test("a link to another page keeps its fragment", async () => {
  const link = await render("/docs/features#gallery");
  assert.equal(link.href, "/docs/features#gallery");
});

test("preloading a link with a fragment matches the page without the fragment", async () => {
  const { router } = await render("/docs/features#gallery");
  const target = getLinkTarget("/docs/features#gallery", "en", router.options);
  assert.ok(target);
  const location = router.buildLocation(target);
  assert.equal(location.pathname, "/docs/features");
  assert.equal(location.hash, "gallery");
});

test("non-ASCII fragments are encoded once", async () => {
  const link = await render("/docs/installation#установка", "ru");
  assert.equal(
    link.href,
    "/ru/docs/installation#%D1%83%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0",
  );
});

test("localized links keep their query and fragment", async () => {
  const link = await render("/docs/features?mode=a#gallery", "ru");
  assert.equal(link.href, "/ru/docs/features?mode=a#gallery");
});

test("a parent page link is not marked as the current page", async () => {
  const link = await render("/docs");
  assert.equal(link.href, "/docs");
  assert.equal(link.current, false);
});

test("a link to the current page is marked as the current page", async () => {
  const link = await render("/docs/current?tab=a");
  assert.equal(link.current, true);
});

test("the sidebar's own current page marking is kept", async () => {
  const link = await render("/docs", "en", { "aria-current": "page" });
  assert.equal(link.current, true);
});

test("relative and query-only links keep their href", async () => {
  for (const href of ["./other", "other.mdx", "../other", "?q=1"]) {
    const link = await render(href, "ru");
    assert.equal(link.href, href);
  }
});

test("a repeated query key is not rewritten", async () => {
  const link = await render("/docs/features?a=1&a=2", "es");
  assert.equal(link.href, "/es/docs/features?a=1&a=2");
});
