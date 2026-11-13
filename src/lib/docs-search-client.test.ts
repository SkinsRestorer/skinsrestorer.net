import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchAPI } from "fumadocs-core/search/server";
import { createDocsSearchClient, searchLanguages } from "./docs-search-client";
import type { Locale } from "./i18n";

const cases: { locale: Locale; title: string; query: string }[] = [
  { locale: "en", title: "Upload a skin", query: "upload" },
  { locale: "es", title: "Subir una skin", query: "subir" },
  { locale: "ru", title: "Загрузить скин", query: "загрузить" },
  { locale: "pt-BR", title: "Enviar uma skin", query: "enviar" },
];

for (const { locale, title, query } of cases) {
  test(`the static client searches the exported ${locale} database`, async () => {
    const server = createSearchAPI("advanced", {
      language: searchLanguages[locale],
      indexes: [
        {
          id: "upload",
          title,
          url: "/docs/features/skin-upload",
          structuredData: {
            headings: [],
            contents: [{ heading: undefined, content: title }],
          },
        },
      ],
    });
    const data = await (await server.staticGET()).json();
    const from = `https://docs-search.test/${locale}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      (...args: Parameters<typeof fetch>) =>
        String(args[0]) === from
          ? Promise.resolve(
              Response.json({ type: "i18n", data: { [locale]: data } }),
            )
          : originalFetch(...args),
      { preconnect: originalFetch.preconnect },
    );
    try {
      const results = await createDocsSearchClient(locale, from).search(query);
      assert.ok(results.some((result) => result.content === title));
      assert.ok(
        results.some((result) => result.url === "/docs/features/skin-upload"),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
