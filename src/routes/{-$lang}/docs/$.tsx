import browserCollections from "fumadocs-mdx:collections/browser";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { Schema } from "effect";
import Link from "fumadocs-core/link";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
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

import {
  docFileInfo,
  isLocale,
  localizeHref,
  localizePath,
  type Locale,
} from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-react";

type ResolvedLink = { url: string; title: string; description?: string };

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
    return {
      path: page.path,
      url: localizePath(page.url, locale),
      locale,
      contentLocale: docFileInfo(page.path).locale,
      alternatives: getDocLanguages(slugs),
      title: page.data.title,
      description: page.data.description,
      image: getPageImage(page).url,
      pageTree: await source.serializePageTree(source.getPageTree(locale)),
      links,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader<{
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
  contentLocale: Locale;
}>({
  id: "docs-page",
  component({ default: MDX, toc, frontmatter }, page) {
    const t = useT();
    const locale = useLocale();
    return (
      <DocsPage
        toc={toc}
        full={frontmatter.full}
        lastUpdate={new Date(frontmatter.reviewed)}
        tableOfContent={{ style: "clerk" }}
      >
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
        {page.contentLocale !== locale && (
          <p className="text-sm text-fd-muted-foreground">
            {t("common.pageAvailableEnglish")}
          </p>
        )}
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
          href: `https://skinsrestorer.net/discord-embed/${loaderData.locale === "en" ? "" : `${loaderData.locale}/`}${loaderData.url.replace(/^\/(?:ru\/|es\/|pt-BR\/)?docs\/?/, "")}`,
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
    <DocsLayout tree={page.pageTree} {...getBaseOptions(locale)}>
      <DocsContent
        path={page.path}
        url={page.url}
        links={page.links}
        contentLocale={page.contentLocale}
      />
    </DocsLayout>
  );
}

function DocsContent(props: {
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
  contentLocale: Locale;
}) {
  return clientLoader.useContent(props.path, props);
}
