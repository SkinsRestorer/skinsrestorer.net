import { Effect, Schema } from "effect";
import { readHttpJson, runHttpEffect } from "./effect-http";
import { type Locale, localizePath, splitLocalePath } from "./i18n";
import type { source } from "./source";

export type SerializedDocsTree = Awaited<
  ReturnType<typeof source.serializePageTree>
>;

/** The build prerenders one navigation tree file per locale. */
export function docsTreeUrl(locale: Locale) {
  return `/api/docs-tree/${locale}`;
}

const serializedDocsTree = Schema.declare(
  (input): input is SerializedDocsTree =>
    typeof input === "object" &&
    input !== null &&
    "$fumadocs_loader" in input &&
    input.$fumadocs_loader === "page-tree" &&
    "data" in input &&
    typeof input.data === "object" &&
    input.data !== null,
);

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class DocsTreeLoadError extends Schema.TaggedError<
  DocsTreeLoadError,
  { readonly brand: unique symbol }
>()("DocsTreeLoadError", { status: Schema.Finite }) {}

/**
 * Read the prerendered tree with a deadline, so a stalled request cannot keep
 * a navigation pending. The signal cancels a superseded navigation's read.
 */
export function readDocsTree(locale: Locale, signal?: AbortSignal) {
  return runHttpEffect(
    readHttpJson(docsTreeUrl(locale), {}, serializedDocsTree).pipe(
      Effect.flatMap((response) =>
        response.ok
          ? Effect.succeed(response.data)
          : Effect.fail(DocsTreeLoadError.make({ status: response.status })),
      ),
    ),
    signal,
  );
}

/**
 * The pages of a serialized tree in sidebar order, a folder's index page
 * first. Its type only says `object`, so check each node.
 */
function* treePages(node: unknown): Generator<{ url: string; name: string }> {
  if (typeof node !== "object" || node === null) return;
  if (
    "type" in node &&
    node.type === "page" &&
    "url" in node &&
    typeof node.url === "string" &&
    "name" in node &&
    typeof node.name === "string"
  ) {
    yield { url: node.url, name: node.name };
  }
  if ("index" in node) yield* treePages(node.index);
  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) yield* treePages(child);
  }
}

/**
 * The sidebar titles of the pages at `paths`, in the given order, with their
 * localized URLs. A path missing from the tree is left out.
 */
export function findTreePages(
  tree: SerializedDocsTree,
  locale: Locale,
  paths: readonly string[],
) {
  const titles = new Map<string, string>();
  for (const page of treePages(tree.data)) {
    const path = splitLocalePath(page.url).path;
    if (titles.has(path)) continue;
    const title = htmlText(page.name);
    if (title) titles.set(path, title);
  }
  return paths.flatMap((path) => {
    const title = titles.get(path);
    return title === undefined
      ? []
      : [{ title, url: localizePath(path, locale) }];
  });
}

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

/**
 * The plain text of a serialized sidebar title. The tree stores titles as
 * HTML, and the search dialog also renders on the server, where no DOM parser
 * exists, so tags are dropped and the common entities decoded here.
 */
function htmlText(html: string) {
  return html
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll(
      /&(amp|lt|gt|quot|apos|#39);/gu,
      (_, name: string) => entities[name] ?? "",
    )
    .trim();
}
