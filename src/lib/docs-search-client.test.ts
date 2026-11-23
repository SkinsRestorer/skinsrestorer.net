import assert from "node:assert/strict";
import { test } from "node:test";
import { createSearchAPI } from "fumadocs-core/search/server";
import type { SortedResult } from "fumadocs-core/search";
import {
  createDocsSearchClient,
  rankDocsResults,
  searchLanguages,
} from "./docs-search-client";
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
    const data: unknown = await (await server.staticGET()).json();
    const from = `https://docs-search.test/${locale}`;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      (...args: Parameters<typeof fetch>) =>
        (args[0] instanceof Request ? args[0].url : args[0].toString()) === from
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

test("search loads the database again after a failed download", async () => {
  const server = createSearchAPI("advanced", {
    language: "english",
    indexes: [
      {
        id: "install",
        title: "Install SkinsRestorer",
        url: "/docs/installation",
        structuredData: {
          headings: [],
          contents: [{ heading: undefined, content: "Install SkinsRestorer" }],
        },
      },
    ],
  });
  const data: unknown = await (await server.staticGET()).json();
  const from = "https://docs-search.test/retry";
  const requested: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    (...args: Parameters<typeof fetch>) => {
      const url = args[0] instanceof Request ? args[0].url : args[0].toString();
      if (!url.startsWith(from)) return originalFetch(...args);
      requested.push(url);
      return Promise.resolve(
        requested.length === 1
          ? new Response("Unavailable", { status: 503 })
          : Response.json({ type: "i18n", data: { en: data } }),
      );
    },
    { preconnect: originalFetch.preconnect },
  );
  try {
    const client = createDocsSearchClient("en", from);
    await assert.rejects(async () => client.search("install"));
    const results = await client.search("install");
    assert.ok(results.some((result) => result.url === "/docs/installation"));
    assert.equal(requested.length, 2);
    assert.notEqual(requested[0], requested[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function page(url: string, title: string, ...hits: SortedResult[]) {
  return [{ id: url, url, type: "page" as const, content: title }, ...hits];
}

function hit(url: string, type: "heading" | "text", content: string) {
  return { id: `${url}-${content}`, url, type, content };
}

const results = [
  ...page(
    "/docs/features",
    "Use skins",
    hit("/docs/features", "text", "Use a cape: copied capes."),
  ),
  ...page(
    "/docs/concepts/skin-properties",
    "Signed skin properties",
    hit("/docs/concepts/skin-properties", "heading", "Model and cape"),
  ),
  ...page("/docs/features/capes", "Use skins with capes"),
];

const pageOrder = (list: SortedResult[]) =>
  list.filter((result) => result.type === "page").map((result) => result.url);

test("pages named after the query come first, then matching headings", () => {
  assert.deepEqual(pageOrder(rankDocsResults(results, "cape")), [
    "/docs/features/capes",
    "/docs/concepts/skin-properties",
    "/docs/features",
  ]);
});

test("ranking keeps each page's hits with their page", () => {
  const ranked = rankDocsResults(results, "cape");
  assert.equal(ranked.length, results.length);
  assert.equal(ranked[1]?.url, "/docs/concepts/skin-properties");
  assert.equal(ranked[2]?.content, "Model and cape");
});

test("a plural query still matches a singular title", () => {
  const list = [
    ...page("/docs/configuration/options", "Configuration reference"),
    ...page("/docs/troubleshooting/permissions", "Permission problems"),
  ];
  assert.deepEqual(pageOrder(rankDocsResults(list, "permissions")), [
    "/docs/troubleshooting/permissions",
    "/docs/configuration/options",
  ]);
});

test("titles match without case or accent differences", () => {
  const list = [
    ...page("/ru/docs", "Документация"),
    ...page("/ru/docs/installation", "Установка SkinsRestorer"),
    ...page("/pt-BR/docs/configuration", "Configuração"),
  ];
  assert.deepEqual(pageOrder(rankDocsResults(list, "установ")), [
    "/ru/docs/installation",
    "/ru/docs",
    "/pt-BR/docs/configuration",
  ]);
  assert.equal(
    pageOrder(rankDocsResults(list, "CONFIGURACAO"))[0],
    "/pt-BR/docs/configuration",
  );
});

test("results without a title or heading match keep the engine order", () => {
  assert.deepEqual(pageOrder(rankDocsResults(results, "signatures")), [
    "/docs/features",
    "/docs/concepts/skin-properties",
    "/docs/features/capes",
  ]);
});
