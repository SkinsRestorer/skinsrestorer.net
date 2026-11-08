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
import { baseOptions } from "@/lib/layout-options";
import { getPageHead } from "@/lib/seo";
import { getMDXComponents } from "@/mdx-components";

type ResolvedLink = { url: string; title: string; description?: string };

const serverLoader = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.mutable(Schema.Array(Schema.String))),
  )
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const { source, getPageImage } = await import("@/lib/source");
    const page = source.getPage(slugs);
    if (!page) throw notFound();
    const links: Record<string, ResolvedLink> = {};
    const { dirname } = await import("node:path");
    for (const reference of page.data.extractedReferences) {
      const found = source.getPageByHref(reference.href, {
        dir: dirname(page.path),
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
      url: page.url,
      title: page.data.title,
      description: page.data.description,
      image: getPageImage(page).url,
      pageTree: await source.serializePageTree(source.pageTree),
      links,
    };
  });

const clientLoader = browserCollections.docs.createClientLoader<{
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
}>({
  id: "docs-page",
  component({ default: MDX, toc, frontmatter }, page) {
    return (
      <DocsPage
        toc={toc}
        full={frontmatter.full}
        lastUpdate={new Date(frontmatter.reviewed)}
        tableOfContent={{ style: "clerk" }}
      >
        <div className="flex flex-col gap-2">
          <DocsTitle>{frontmatter.title}</DocsTitle>
          <DocsDescription className="mb-2.5">
            {frontmatter.description}
          </DocsDescription>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fd-muted-foreground">
            <span>SkinsRestorer {frontmatter.version}</span>
            <span>{frontmatter.appliesTo}</span>
            <span>
              Reviewed{" "}
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
        <DocsBody>
          <MDX
            components={getMDXComponents({
              a: ({ href, ...props }) => {
                const found = page.links[href ?? ""];
                if (!found) return <Link href={href ?? ""} {...props} />;
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

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const page = await serverLoader({
      data: params._splat?.split("/").filter(Boolean) ?? [],
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
          href: `https://skinsrestorer.net/discord-embed/${loaderData.url.replace(/^\/docs\/?/, "")}`,
        },
      ],
    };
  },
  component: DocsRoute,
});

function DocsRoute() {
  const page = useFumadocsLoader(Route.useLoaderData());
  return (
    <DocsLayout tree={page.pageTree} {...baseOptions}>
      <DocsContent path={page.path} url={page.url} links={page.links} />
    </DocsLayout>
  );
}

function DocsContent(props: {
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
}) {
  return clientLoader.useContent(props.path, props);
}
