import type { SortedResult } from "fumadocs-core/search";
import type { SearchClient } from "fumadocs-core/search/client";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import { create, type Language } from "zbsearch";
import type { Locale } from "./i18n";

export const searchLanguages: Record<Locale, Language> = {
  en: "english",
  ru: "russian",
  es: "spanish",
  "pt-BR": "portuguese",
};

/** Search shows at most this many pages, each with its matching sections. */
export const maxSearchPages = 12;

function words(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Accept prefixes while typing and short inflections such as plurals. */
function matchesAll(text: string, terms: string[]) {
  const candidates = words(text);
  return terms.every((term) =>
    candidates.some(
      (word) =>
        word.startsWith(term) ||
        (word.length >= 4 &&
          term.startsWith(word) &&
          term.length - word.length <= 2),
    ),
  );
}

/**
 * Body text often outscores a short page title, so a page named after the
 * query can fall below pages that only mention it. Move pages whose title, then
 * pages whose heading, contains every query word ahead of the rest. Keep the
 * engine's order inside each tier.
 */
export function rankDocsResults(
  results: SortedResult[],
  query: string,
): SortedResult[] {
  const terms = words(query);
  const groups: SortedResult[][] = [];
  for (const result of results) {
    if (result.type === "page" || groups.length === 0) groups.push([result]);
    else groups[groups.length - 1].push(result);
  }
  const tier = (group: SortedResult[]) => {
    if (terms.length === 0) return 0;
    if (group[0].type === "page" && matchesAll(group[0].content, terms))
      return 2;
    return group.some(
      (result) =>
        result.type === "heading" && matchesAll(result.content, terms),
    )
      ? 1
      : 0;
  };
  return groups
    .map((group, index) => ({ group, index, tier: tier(group) }))
    .sort((a, b) => b.tier - a.tier || a.index - b.index)
    .slice(0, maxSearchPages)
    .flatMap(({ group }) => group);
}

/** Match the server tokenizer when loading each exported locale database. */
export function createDocsSearchClient(
  locale: Locale,
  from = "/api/search",
): SearchClient {
  const client = staticClient({
    from,
    locale,
    // The limit caps raw hits before grouping. Fewer hits per page leave room
    // for more pages, which the ranking below then reorders.
    search: { limit: 80, groupBy: { properties: ["page_id"], maxResult: 3 } },
    initDB: (language) =>
      create({
        schema: { _: "string" },
        language: searchLanguages[language as Locale] ?? "english",
      }),
  });
  return {
    deps: client.deps,
    search: async (query) => rankDocsResults(await client.search(query), query),
  };
}
