import { Effect, Schema } from "effect";
import type { InferPageType } from "fumadocs-core/source";
import { flattenTree, type Node } from "fumadocs-core/page-tree";
import { isLocale, type Locale } from "@/lib/i18n";
import { absoluteDocsUrl, formatExportedMarkdown } from "@/lib/llm-markdown";
import { translate, type MessageKey } from "@/lib/messages";
import { source } from "@/lib/source";

type DocsPage = InferPageType<typeof source>;

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class DocumentTextError extends Schema.TaggedError<
  DocumentTextError,
  { readonly brand: unique symbol }
>()("DocumentTextError", {
  url: Schema.String,
  cause: Schema.Unknown,
}) {}

const getLLMTextEffect = Effect.fn("Docs.getText")(function* (page: DocsPage) {
  const processed = yield* Effect.tryPromise({
    try: () => page.data.getText("processed"),
    catch: (cause) => DocumentTextError.make({ url: page.url, cause }),
  });
  const locale = isLocale(page.locale) ? page.locale : "en";
  const url = absoluteDocsUrl(page.url, locale);
  return `# ${page.data.title}
URL: ${url}
SkinsRestorer: ${page.data.version}
Applies to: ${page.data.appliesTo}
Reviewed: ${page.data.reviewed}

${page.data.description}

${formatExportedMarkdown(processed, locale, url)}`;
});

/**
 * Follow the sidebar order, including pages that the sidebar only links to
 * from another section. Pages outside the sidebar come last.
 */
function orderPages(nodes: Node[], remaining: Map<string, DocsPage>) {
  const ordered: DocsPage[] = [];
  for (const node of flattenTree(nodes)) {
    const page = remaining.get(node.url);
    if (!page) continue;
    ordered.push(page);
    remaining.delete(node.url);
  }
  return ordered;
}

function pagesByUrl(locale: Locale) {
  return new Map(source.getPages(locale).map((page) => [page.url, page]));
}

const getFullLLMTextEffect = Effect.fn("Docs.getFullText")(function* () {
  const remaining = pagesByUrl("en");
  const pages = [
    ...orderPages(source.getPageTree("en").children, remaining),
    ...remaining.values(),
  ];
  const texts = yield* Effect.forEach(pages, getLLMTextEffect, {
    concurrency: 4,
  });
  return texts.join("\n\n");
});

const line = (page: DocsPage) =>
  `- [${page.data.title}](${absoluteDocsUrl(`${page.url}.mdx`)}): ${page.data.description}`;

/** Browser tools that docs pages send players to. */
const websiteTools = [
  ["/studio", "studio.title", "seo.studioDescription"],
  ["/upload", "upload.title", "seo.uploadDescription"],
  ["/generator", "generator.title", "generator.description"],
] as const satisfies readonly (readonly [string, MessageKey, MessageKey])[];

/**
 * The llms.txt index: sidebar sections with links to Markdown pages, then the
 * website tools.
 */
export function getLLMIndex() {
  const tree = source.getPageTree("en");
  const remaining = pagesByUrl("en");
  const home = remaining.get("/docs");
  const sections: string[] = [];
  const topLevel = orderPages(
    tree.children.filter((node) => node.type !== "folder"),
    remaining,
  );
  for (const node of tree.children) {
    if (node.type !== "folder") continue;
    const pages = orderPages([node], remaining);
    const [first] = pages;
    if (!first) continue;
    const name = typeof node.name === "string" ? node.name : first.data.title;
    sections.push(
      `## ${name}\n\n${pages.map((page) => line(page)).join("\n")}`,
    );
  }
  const other = [...topLevel, ...remaining.values()];
  if (other.length > 0)
    sections.unshift(
      `## Overview\n\n${other.map((page) => line(page)).join("\n")}`,
    );
  return [
    "# SkinsRestorer documentation",
    `> ${home?.data.description ?? "Install, configure, and extend SkinsRestorer."}`,
    `The complete documentation as one file: ${absoluteDocsUrl("/llms-full.txt")}`,
    ...sections,
    `## Website tools\n\n${websiteTools
      .map(
        ([path, title, description]) =>
          `- [${translate("en", title)}](${absoluteDocsUrl(path)}): ${translate("en", description)}`,
      )
      .join("\n")}`,
  ].join("\n\n");
}

export const getLLMText = (page: DocsPage, signal?: AbortSignal) =>
  Effect.runPromise(getLLMTextEffect(page), { signal });
export const getFullLLMText = (signal?: AbortSignal) =>
  Effect.runPromise(getFullLLMTextEffect(), { signal });
