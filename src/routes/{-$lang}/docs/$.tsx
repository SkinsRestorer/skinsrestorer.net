import browserCollections from "fumadocs-mdx:collections/browser";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { Schema } from "effect";
import { Link } from "fumadocs-core/link";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Callout } from "fumadocs-ui/components/callout";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { useSidebar } from "fumadocs-ui/layouts/docs/slots/sidebar";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { CookieSettingsButton } from "@/components/cookie-consent-banner";
import { EnderDashSponsor } from "@/components/enderdash-sponsor";
import { Feedback } from "@/components/feedback";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { getBaseOptions } from "@/lib/layout-options";
import { getPageHead } from "@/lib/seo";
import { getMDXComponents } from "@/mdx-components";
import { useEffect, type KeyboardEvent } from "react";

import {
  docFileInfo,
  isLocale,
  localizeHref,
  localizePath,
  type Locale,
} from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-react";

interface ResolvedLink {
  url: string;
  title: string;
  description?: string;
}
interface FooterLink {
  url: string;
  name: string;
  description?: string;
}

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
    const links: Record<string, ResolvedLink> = {};
    const { dirname } = await import("node:path");
    for (const reference of page.data.extractedReferences) {
      const found = source.getPageByHref(reference.href, {
        dir: dirname(page.path),
        language: locale,
      });
      if (found) {
        links[reference.href] = {
          url: found.hash ? `${found.page.url}#${found.hash}` : found.page.url,
          title: found.page.data.title,
          description: found.page.data.description,
        };
      }
    }
    const pageTree = source.getPageTree(locale);
    // Sidebar shortcuts repeat pages from other sections. Count each page once,
    // at its first position, so previous and next links agree in both
    // directions. Shortcut URLs in meta files have no locale prefix.
    const { flattenTree } = await import("fumadocs-core/page-tree");
    const sequence = [
      ...new Set(
        flattenTree(pageTree.children)
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
    return {
      path: page.path,
      url: localizePath(page.url, locale),
      locale,
      contentLocale: docFileInfo(page.path).locale,
      alternatives: getDocLanguages(slugs),
      title: page.data.title,
      description: page.data.description,
      image: getPageImage(page).url,
      pageTree: await source.serializePageTree(pageTree),
      links,
      neighbours: { previous: footerLink(-1), next: footerLink(1) },
    };
  });

const clientLoader = browserCollections.docs.createClientLoader<{
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
  contentLocale: Locale;
  neighbours: { previous?: FooterLink; next?: FooterLink };
}>({
  id: "docs-page",
  // fumadocs calls this as a hook (`useRenderer`) inside its page renderer.
  component: function useDocsPageContent(
    { default: MDX, toc, frontmatter },
    page,
  ) {
    const t = useT();
    const locale = useLocale();
    return (
      <DocsPage
        toc={toc}
        full={frontmatter.full}
        // The skip link targets this article, so it must accept focus.
        tabIndex={-1}
        className="outline-none"
        tableOfContent={{
          style: "clerk",
          container: { role: "navigation", "aria-labelledby": "toc-title" },
        }}
        tableOfContentPopover={{
          container: {
            role: "navigation",
            "aria-label": t("common.page"),
            onKeyDown: closeTocPopoverOnEscape,
          },
          trigger: {
            className:
              "focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-inset",
          },
        }}
        footer={{ items: page.neighbours }}
      >
        {page.contentLocale !== locale && (
          <Callout type="info" className="my-0">
            {t("common.pageAvailableEnglish")}
          </Callout>
        )}
        <div className="flex flex-col gap-2">
          <DocsTitle lang={page.contentLocale}>{frontmatter.title}</DocsTitle>
          <DocsDescription lang={page.contentLocale} className="mb-2.5">
            {frontmatter.description}
          </DocsDescription>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fd-muted-foreground">
            <span>SkinsRestorer {frontmatter.version}</span>
            <span lang={page.contentLocale}>{frontmatter.appliesTo}</span>
            <span>
              {t("common.reviewed")}{" "}
              <time dateTime={frontmatter.reviewed}>
                {frontmatter.reviewed}
              </time>
            </span>
          </p>
          <div className="flex flex-row items-center gap-2 border-b pt-2 pb-6">
            <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
            <ViewOptions
              markdownUrl={`https://skinsrestorer.net${page.url}.mdx`}
              githubUrl={`https://github.com/SkinsRestorer/skinsrestorer.net/blob/main/content/docs/${page.path}`}
            />
          </div>
        </div>
        <DocsBody lang={page.contentLocale}>
          <MDX
            components={getMDXComponents({
              a: ({ href, ...props }) => {
                const found = page.links[href ?? ""];
                if (!found)
                  return (
                    <Link href={localizeHref(href ?? "", locale)} {...props} />
                  );
                return (
                  <HoverCard>
                    <HoverCardTrigger
                      render={<Link href={found.url} {...props} />}
                    />
                    <HoverCardContent className="text-sm">
                      <p className="font-medium">{found.title}</p>
                      <p className="text-fd-muted-foreground">
                        {found.description}
                      </p>
                    </HoverCardContent>
                  </HoverCard>
                );
              },
            })}
          />
        </DocsBody>
        <Feedback key={page.url} url={page.url} version={frontmatter.version} />
        <EnderDashSponsor placement="docs-footer" />
      </DocsPage>
    );
  },
});

// The mobile table of contents is a disclosure without Escape handling.
function closeTocPopoverOnEscape(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Escape") return;
  const trigger = event.currentTarget.querySelector<HTMLElement>(
    "[data-toc-popover-trigger][aria-expanded='true']",
  );
  if (!trigger) return;
  event.preventDefault();
  trigger.click();
  trigger.focus();
}

export const Route = createFileRoute("/{-$lang}/docs/$")({
  loader: async ({ params }) => {
    const page = await serverLoader({
      data: [
        params.lang ?? "en",
        ...(params._splat?.split("/").filter(Boolean) ?? []),
      ],
    });
    await clientLoader.preload(page.path);
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
          href: `https://skinsrestorer.net/discord-embed/${loaderData.locale === "en" ? "" : `${loaderData.locale}/`}${loaderData.url.replace(/^\/(?:ru\/|es\/|pt-BR\/)?docs\/?/u, "")}`,
        },
      ],
    };
  },
  component: DocsRoute,
});

function DocsRoute() {
  const page = useFumadocsLoader(Route.useLoaderData());
  const locale = useLocale();
  return (
    <DocsLayout
      tree={page.pageTree}
      {...getBaseOptions(locale)}
      containerProps={{ className: skipLinkClassName }}
      sidebar={{
        footer: (
          <CookieSettingsButton className="self-start px-1 pt-2 text-xs text-fd-muted-foreground hover:text-fd-foreground" />
        ),
      }}
    >
      <SidebarDrawerFocus />
      <DocsContent
        path={page.path}
        url={page.url}
        links={page.links}
        contentLocale={page.contentLocale}
        neighbours={page.neighbours}
      />
    </DocsLayout>
  );
}

// Fumadocs renders an sr-only "Skip to content" link to #nd-page as the
// first child of the layout container. Show it on focus, like the home page.
const skipLinkClassName = [
  "[&>a[href='#nd-page']:focus-visible]:not-sr-only",
  "[&>a[href='#nd-page']:focus-visible]:fixed",
  "[&>a[href='#nd-page']:focus-visible]:top-2",
  "[&>a[href='#nd-page']:focus-visible]:left-2",
  "[&>a[href='#nd-page']:focus-visible]:z-100",
  "[&>a[href='#nd-page']:focus-visible]:rounded-md",
  "[&>a[href='#nd-page']:focus-visible]:bg-background",
  "[&>a[href='#nd-page']:focus-visible]:px-3",
  "[&>a[href='#nd-page']:focus-visible]:py-2",
  "[&>a[href='#nd-page']:focus-visible]:text-sm",
  "[&>a[href='#nd-page']:focus-visible]:text-foreground",
  "[&>a[href='#nd-page']:focus-visible]:ring-2",
  "[&>a[href='#nd-page']:focus-visible]:ring-ring",
  "[&>a[href='#nd-page']:focus-visible]:outline-none",
].join(" ");

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// The mobile sidebar drawer closes on Escape but leaves focus management to
// the page. While it is open, keep Tab inside it, then return focus to the
// control that opened it.
function SidebarDrawerFocus() {
  const { open, mode } = useSidebar();
  useEffect((): (() => void) | undefined => {
    if (!open || mode !== "drawer") return undefined;
    const drawer = document.querySelector("#nd-sidebar-mobile");
    if (!drawer) return undefined;
    const active = document.activeElement;
    const opener =
      active instanceof HTMLElement && !drawer.contains(active)
        ? active
        : document.querySelector<HTMLElement>(
            "[aria-controls='nd-sidebar-mobile']",
          );
    const focusable = () =>
      [...drawer.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) =>
          !element.closest("[inert]") && element.getClientRects().length > 0,
      );
    focusable()[0]?.focus();

    const trapTab = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const current = document.activeElement;
      if (!drawer.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => {
      document.removeEventListener("keydown", trapTab);
      const current = document.activeElement;
      if (!current || current === document.body || drawer.contains(current)) {
        opener?.focus({ preventScroll: true });
      }
    };
  }, [open, mode]);
  return null;
}

function DocsContent(props: {
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
  contentLocale: Locale;
  neighbours: { previous?: FooterLink; next?: FooterLink };
}) {
  return clientLoader.useContent(props.path, props);
}
