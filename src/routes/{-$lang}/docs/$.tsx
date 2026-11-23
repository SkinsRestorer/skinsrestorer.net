import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { Schema } from "effect";
import {
  docsClientLoader,
  type DocsPageData,
  type FooterLink,
} from "@/components/docs-page";
import { getPageHead } from "@/lib/seo";
import {
  docFileInfo,
  isLocale,
  localizePath,
  splitLocalePath,
} from "@/lib/i18n";

const serverLoader = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.mutable(Schema.Array(Schema.String))),
  )
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: [language, ...slugs] }) => {
    if (!isLocale(language)) throw notFound();
    const locale = language;
    const { source, getPageImage, getDocLanguages } =
      await import("@/lib/source");
    const page = source.getPage(slugs, locale);
    if (!page) throw notFound();
    const { resolveDocLinks } = await import("@/lib/docs-links");
    const links = resolveDocLinks(source, page, locale);
    // Sidebar shortcuts repeat pages from other sections. Count each page once,
    // at its first position, so previous and next links agree in both
    // directions. Shortcut URLs in meta files have no locale prefix.
    const { flattenTree } = await import("fumadocs-core/page-tree");
    const sequence = [
      ...new Set(
        flattenTree(source.getPageTree(locale).children)
          .filter((item) => !item.external)
          .map((item) => localizePath(item.url, locale)),
      ),
    ];
    const pages = new Map(
      source
        .getPages(locale)
        .map((entry) => [localizePath(entry.url, locale), entry]),
    );
    const position = sequence.indexOf(localizePath(page.url, locale));
    const footerLink = (offset: number): FooterLink | undefined => {
      const url = position === -1 ? undefined : sequence[position + offset];
      const target = url === undefined ? undefined : pages.get(url);
      return target
        ? {
            url: localizePath(target.url, locale),
            name: target.data.title,
            description: target.data.description,
          }
        : undefined;
    };
    const { getBreadcrumbItems } = await import("fumadocs-core/breadcrumb");
    const home = source.getPage([], locale);
    const breadcrumbs = [
      ...(home && home !== page
        ? [{ name: home.data.title, url: localizePath(home.url, locale) }]
        : []),
      // Folders without an index page have no URL to link to.
      ...getBreadcrumbItems(page.url, source.getPageTree(locale), {
        includePage: true,
      }).flatMap(({ name, url }) =>
        typeof name === "string" && url
          ? [{ name, url: localizePath(url, locale) }]
          : [],
      ),
    ];
    const previous = footerLink(-1);
    const next = footerLink(1);
    return {
      path: page.path,
      url: localizePath(page.url, locale),
      locale,
      contentLocale: docFileInfo(page.path).locale,
      alternatives: getDocLanguages(slugs),
      title: page.data.title,
      description: page.data.description,
      image: getPageImage(page).url,
      links,
      breadcrumbs,
      neighbours: {
        ...(previous === undefined ? {} : { previous }),
        ...(next === undefined ? {} : { next }),
      },
    };
  });

/**
 * In the browser, the static middleware reads a prerendered snapshot without
 * checking the response status. A page removed by a later deploy has no
 * snapshot, so the 404 body fails to parse as JSON. Show the not-found page.
 */
async function loadPage(data: string[]) {
  try {
    return await serverLoader({ data });
  } catch (error) {
    if (typeof document !== "undefined" && error instanceof SyntaxError)
      throw notFound();
    throw error;
  }
}

export const Route = createFileRoute("/{-$lang}/docs/$")({
  loader: async ({ params }) => {
    const page = await loadPage([
      params.lang ?? "en",
      ...(params._splat?.split("/").filter(Boolean) ?? []),
    ]);
    // The MDX renderer is a separate chunk, so pages outside the docs never
    // download it.
    const { docsClientLoader: loader, hasDocsContent } =
      await import("@/components/docs-page");
    if (typeof window !== "undefined" && !hasDocsContent(page.path)) {
      // This tab predates the deploy that added the page's file. Load the new
      // build, as for any other missing chunk.
      window.dispatchEvent(
        new Event("vite:preloadError", { cancelable: true }),
      );
    }
    await loader.preload(page.path);
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const head = getPageHead(loaderData.url, loaderData);
    return {
      ...head,
      links: [
        ...head.links,
        {
          rel: "discord:component-embed",
          type: "application/json",
          href: `https://skinsrestorer.net/discord-embed/${loaderData.locale === "en" ? "" : `${loaderData.locale}/`}${splitLocalePath(loaderData.url).path.replace(/^\/docs\/?/u, "")}`,
        },
      ],
    };
  },
  component: DocsRoute,
});

function DocsRoute() {
  const page = Route.useLoaderData();
  return (
    <DocsContent
      path={page.path}
      url={page.url}
      links={page.links}
      contentLocale={page.contentLocale}
      neighbours={page.neighbours}
    />
  );
}

function DocsContent(props: DocsPageData) {
  return docsClientLoader.useContent(props.path, props);
}
