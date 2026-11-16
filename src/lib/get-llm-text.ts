import { Data, Effect } from "effect";
import type { InferPageType } from "fumadocs-core/source";
import { flattenTree, type Node } from "fumadocs-core/page-tree";
import type { Locale } from "@/lib/i18n";
import { absoluteDocsUrl, formatExportedMarkdown } from "@/lib/llm-markdown";
import { source } from "@/lib/source";

type DocsPage = InferPageType<typeof source>;

export class DocumentTextError extends Data.TaggedError("DocumentTextError")<{
  readonly url: string;
  readonly cause: unknown;
}> {}

export const getLLMTextEffect = Effect.fn("Docs.getText")(function* (
  page: DocsPage,
) {
  const processed = yield* Effect.tryPromise({
    try: () => page.data.getText("processed"),
    catch: (cause) => new DocumentTextError({ url: page.url, cause }),
  });
  const locale = (page.locale ?? "en") as Locale;
  return `# ${page.data.title}
URL: ${absoluteDocsUrl(page.url, locale)}
SkinsRestorer: ${page.data.version}
Applies to: ${page.data.appliesTo}
Reviewed: ${page.data.reviewed}

${page.data.description}

${formatExportedMarkdown(processed, locale)}`;
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

export const getFullLLMTextEffect = Effect.fn("Docs.getFullText")(function* () {
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

/** The llms.txt index: sidebar sections with links to Markdown pages. */
export function getLLMIndex() {
  const tree = source.getPageTree("en");
  const remaining = pagesByUrl("en");
  const home = remaining.get("/docs");
  const line = (page: DocsPage) =>
    `- [${page.data.title}](${absoluteDocsUrl(`${page.url}.mdx`)}): ${page.data.description}`;
  const sections: string[] = [];
  const topLevel = orderPages(
    tree.children.filter((node) => node.type !== "folder"),
    remaining,
  );
  for (const node of tree.children) {
    if (node.type !== "folder") continue;
    const pages = orderPages([node], remaining);
    if (pages.length === 0) continue;
    const name =
      typeof node.name === "string" ? node.name : pages[0].data.title;
    sections.push(`## ${name}\n\n${pages.map(line).join("\n")}`);
  }
  const other = [...topLevel, ...remaining.values()];
  if (other.length)
    sections.unshift(`## Overview\n\n${other.map(line).join("\n")}`);
  return [
    "# SkinsRestorer documentation",
    `> ${home?.data.description ?? "Install, configure, and extend SkinsRestorer."}`,
    `The complete documentation as one file: ${absoluteDocsUrl("/llms-full.txt")}`,
    ...sections,
  ].join("\n\n");
}

export const getLLMText = (page: DocsPage, signal?: AbortSignal) =>
  Effect.runPromise(getLLMTextEffect(page), { signal });
export const getFullLLMText = (signal?: AbortSignal) =>
  Effect.runPromise(getFullLLMTextEffect(), { signal });
