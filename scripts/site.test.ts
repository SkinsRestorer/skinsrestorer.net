import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import {
  createDocsSearchClient,
  docsSearchUrl,
  maxSearchPages,
} from "../src/lib/docs-search-client";
import { docsTreeUrl } from "../src/lib/docs-tree";
import { isLocale } from "../src/lib/i18n";
import { localizedSitePages } from "../src/lib/site-pages";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { fromJSON, type SerovalJSON } from "seroval";
import { docsMetadataFunctionId } from "./static-docs";

// Run against `bun run preview` with `bun run test:site` after building.
const baseUrl = process.env["SITE_TEST_URL"];

function isSerovalJson(value: unknown): value is SerovalJSON {
  return (
    typeof value === "object" &&
    value !== null &&
    "t" in value &&
    typeof value.t === "object" &&
    value.t !== null &&
    "f" in value &&
    typeof value.f === "number" &&
    "m" in value &&
    Array.isArray(value.m)
  );
}

/**
 * Ask TanStack's own static middleware client which cache file a production
 * browser requests, instead of copying its private cache-key formula.
 */
async function staticDocsMetadataPath(data: string[]) {
  const client = staticFunctionMiddleware.options.client;
  assert.ok(client, "Static function middleware has no client handler");
  const globals = globalThis as { document?: unknown };
  const saved = {
    fetch: globalThis.fetch,
    document: globals.document,
    environment: process.env["NODE_ENV"],
  };
  // Stop at the request. Decoding the response needs the Start runtime.
  const stop = new Error("Captured static cache request");
  let captured: string | undefined;
  globalThis.fetch = Object.assign(
    (input: string | URL | Request) => {
      captured = input instanceof Request ? input.url : String(input);
      return Promise.reject(stop);
    },
    { preconnect: saved.fetch.preconnect },
  );
  // The client reads the static cache only in a production browser.
  globals.document = {};
  process.env["NODE_ENV"] = "production";
  try {
    // The route validator types this data, but the shared middleware type
    // does not see it, so call the client handler untyped.
    await Reflect.apply(client, undefined, [
      {
        data,
        context: {},
        serverFnMeta: { id: docsMetadataFunctionId },
        next: () => {
          throw new Error("Static middleware skipped the cache");
        },
      },
    ]);
  } catch (error) {
    if (error === stop && captured) return captured;
    throw error;
  } finally {
    globalThis.fetch = saved.fetch;
    globals.document = saved.document;
    if (saved.environment === undefined) delete process.env["NODE_ENV"];
    else process.env["NODE_ENV"] = saved.environment;
  }
  throw new Error("Static middleware did not request the cache");
}

test(
  "production routes preserve pages, metadata, and public endpoints",
  { skip: !baseUrl, timeout: 30_000 },
  async () => {
    const request = (path: string, init?: RequestInit) =>
      fetch(new URL(path, baseUrl), {
        signal: AbortSignal.timeout(15_000),
        ...init,
      });

    for (const [path, heading] of [
      ["/", "Player skins for your Minecraft server"],
      ["/studio", "Skin Studio"],
      ["/generator", "Custom skin generator"],
      ["/upload", "Upload a skin"],
      ["/pricing", "Free and supporter plans"],
      ["/privacy-policy", "Privacy Policy"],
      ["/terms-of-service", "Terms of Service"],
      ["/cookie-policy", "Cookie Policy"],
      ["/docs", "SkinsRestorer documentation"],
      ["/docs/installation", "Install SkinsRestorer"],
    ] as const) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.equal(
        response.headers.get("x-content-type-options"),
        "nosniff",
        path,
      );
      assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN", path);
      assert.ok(
        response.headers.has("etag") ||
          ["HIT", "MISS", "EXPIRED", "REVALIDATED"].includes(
            response.headers.get("cf-cache-status") ?? "",
          ),
        `Page must be served as a static asset: ${path}`,
      );
      assert.match(
        response.headers.get("content-type") ?? "",
        /text\/html/u,
        path,
      );
      const html = await response.text();
      const title = html
        .match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/u)?.[1]
        ?.replaceAll(/<[^>]+>/gu, "")
        .trim();
      assert.equal(title, heading, `Missing page heading: ${path}`);
      assert.ok(
        html.includes(
          `href="https://skinsrestorer.net${path === "/" ? "/" : path}"`,
        ),
        `Missing canonical URL: ${path}`,
      );
    }

    for (const [locale, heading] of [
      ["ru", "Загрузка скина"],
      ["es", "Subir skin"],
      ["pt-BR", "Enviar skin"],
    ] as const) {
      const response = await request(`/${locale}/upload?skin=example`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(`<html lang="${locale}"`));
      assert.ok(html.includes(heading));
      assert.ok(
        html.includes(
          `rel="canonical" href="https://skinsrestorer.net/${locale}/upload"`,
        ),
      );
      for (const language of ["en", "ru", "es", "pt-BR", "x-default"]) {
        assert.ok(html.includes(`hrefLang="${language}"`));
      }
      assert.ok(!/rel="canonical"[^>]+skin=/u.test(html));
      const translated = await (
        await request(`/${locale}/docs/installation`)
      ).text();
      assert.ok(
        translated.includes(
          `rel="canonical" href="https://skinsrestorer.net/${locale}/docs/installation"`,
        ),
      );
      assert.ok(translated.includes('id="before-you-start"'));
      const fallback = await (
        await request(`/${locale}/docs/development`)
      ).text();
      assert.ok(
        fallback.includes(
          'rel="canonical" href="https://skinsrestorer.net/docs/development"',
        ),
      );
      assert.ok(fallback.includes('lang="en"'));
      assert.ok(!fallback.includes(`hrefLang="${locale}"`));
      const markdown = await request(`/${locale}/docs/installation.mdx`);
      assert.equal(markdown.status, 200);
      assert.equal(markdown.headers.get("content-language"), locale);
      assert.equal(
        markdown.headers.get("link"),
        `<https://skinsrestorer.net/${locale}/docs/installation>; rel="canonical"`,
      );
      const fallbackMarkdown = await request(`/${locale}/docs/development.mdx`);
      assert.equal(fallbackMarkdown.headers.get("content-language"), "en");
      assert.equal(
        fallbackMarkdown.headers.get("link"),
        '<https://skinsrestorer.net/docs/development>; rel="canonical"',
      );
    }

    const docs = await (await request("/docs/installation")).text();
    assert.ok(docs.includes("<title>Install SkinsRestorer</title>"));
    assert.ok(
      docs.includes("https://skinsrestorer.net/docs-og/installation/image.png"),
    );
    assert.ok(docs.includes("discord:component-embed"));

    for (const path of ["/docs.mdx", "/docs/installation.mdx"]) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.match(
        response.headers.get("content-type") ?? "",
        /text\/markdown/u,
        path,
      );
      assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=3600",
        path,
      );
      // Copied Markdown links absolutely, so it works outside the site.
      assert.match(
        await response.text(),
        /^# .+\nURL: https:\/\/skinsrestorer\.net\/docs/u,
      );
      const head = await request(path, { method: "HEAD" });
      assert.equal(head.status, 200, `HEAD ${path}`);
      assert.equal(await head.text(), "");
    }

    const index = await (await request("/llms.txt")).text();
    assert.ok(index.includes("/docs/installation"));
    assert.ok(index.includes("(https://skinsrestorer.net/studio)"));
    const fullResponse = await request("/llms-full.txt");
    assert.equal(
      fullResponse.headers.get("cache-control"),
      "public, max-age=3600",
    );
    const full = await fullResponse.text();
    assert.ok(full.includes("# Install SkinsRestorer"));
    assert.ok(full.includes("Reviewed:"));
    assert.match(
      await (await request("/robots.txt")).text(),
      /Sitemap: https:\/\/skinsrestorer.net\/sitemap.xml/u,
    );
    const sitemapResponse = await request("/sitemap.xml");
    assert.equal(
      sitemapResponse.headers.get("cache-control"),
      "public, max-age=3600",
    );
    const sitemap = await sitemapResponse.text();
    // One URL per site page and per docs file in its own locale, so adding
    // a translation does not need a test change.
    const docFiles = readdirSync("content/docs", { recursive: true }).filter(
      (file) => String(file).endsWith(".mdx"),
    ).length;
    assert.equal(
      (sitemap.match(/<url>/gu) ?? []).length,
      localizedSitePages.length + docFiles,
    );
    assert.ok(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
    assert.ok(sitemap.includes('hreflang="x-default"'));
    assert.ok(
      !sitemap.includes(
        "<loc>https://skinsrestorer.net/ru/docs/development</loc>",
      ),
    );
    assert.ok(
      sitemap.includes(
        "<loc>https://skinsrestorer.net/docs/installation</loc>",
      ),
    );
    assert.ok(!sitemap.includes(".mdx</loc>"));

    const search = await request(docsSearchUrl("en"));
    assert.ok(search.headers.has("etag"));
    const searchIndex: unknown = await search.json();
    assert.ok(
      typeof searchIndex === "object" &&
        searchIndex !== null &&
        "type" in searchIndex &&
        "data" in searchIndex &&
        typeof searchIndex.data === "object" &&
        searchIndex.data !== null,
    );
    assert.equal(searchIndex.type, "i18n");
    // Each locale has its own index file.
    assert.deepEqual(Object.keys(searchIndex.data), ["en"]);
    const client = createDocsSearchClient(
      "en",
      new URL(docsSearchUrl("en"), baseUrl).href,
    );
    const results = await client.search("skin");
    const resultPages = new Set(
      results.map((result) => result.url.split("#")[0]),
    );
    assert.ok(resultPages.size > 0 && resultPages.size <= maxSearchPages);
    assert.ok(results.every((result) => result.url.startsWith("/docs")));
    for (const [locale, query] of [
      ["ru", "скин"],
      ["es", "skin"],
      ["pt-BR", "skin"],
    ] as const) {
      assert.ok(isLocale(locale));
      const localizedClient = createDocsSearchClient(
        locale,
        new URL(docsSearchUrl(locale), baseUrl).href,
      );
      const matches = await localizedClient.search(query);
      assert.ok(matches.length > 0, `Search must find ${locale} pages`);
      assert.ok(
        matches.every((match) => match.url.startsWith(`/${locale}/docs`)),
      );
    }
    assert.equal(search.headers.get("x-content-type-options"), "nosniff");
    assert.equal(search.headers.get("x-frame-options"), "SAMEORIGIN");

    for (const slugs of [[], ["installation"]]) {
      const response = await request(
        await staticDocsMetadataPath(["en", ...slugs]),
      );
      assert.equal(response.status, 200);
      assert.ok(response.headers.has("etag"));
      const payload: unknown = await response.json();
      assert.ok(isSerovalJson(payload));
      const metadata = fromJSON<{
        result: { url: string; title: string; pageTree?: unknown };
      }>(payload).result;
      assert.equal(
        metadata.url,
        `/docs${slugs.length > 0 ? `/${slugs.join("/")}` : ""}`,
      );
      assert.ok(metadata.title);
      // The navigation tree has its own file per locale.
      assert.equal(metadata.pageTree, undefined);
    }
    const tree = await request(docsTreeUrl("ru"));
    assert.equal(tree.status, 200);
    assert.ok(JSON.stringify(await tree.json()).includes("/ru/docs"));

    const embed = await request("/discord-embed/installation");
    assert.equal(embed.status, 200);
    assert.match(embed.headers.get("content-type") ?? "", /application\/json/u);
    assert.ok(
      JSON.stringify(await embed.json()).includes("Install SkinsRestorer"),
    );
    const image = await request("/docs-og/installation/image.png");
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    const png = new DataView(await image.arrayBuffer());
    assert.equal(png.getUint32(16), 1200);
    assert.equal(png.getUint32(20), 630);

    for (const [path, status, destination] of [
      ["/install?from=test", 307, "/docs/installation?from=test"],
      ["/editor?texture=abc", 308, "/studio?texture=abc"],
      ["/ru/editor", 308, "/ru/studio"],
      ["/docs/features/skin-url", 308, "/docs/features/skin-upload"],
      ["/docs/features/skin-url.mdx", 308, "/docs/features/skin-upload.mdx"],
      ["/llms.mdx/installation", 308, "/docs/installation.mdx"],
    ] as const) {
      const response = await request(path, { redirect: "manual" });
      assert.equal(response.status, status, path);
      assert.equal(
        response.headers.get("location"),
        new URL(destination, baseUrl).href,
      );
    }

    for (const path of [
      "/de/upload",
      "/ru/docs/not-a-page",
      "/de/docs/installation.mdx",
      "/not-a-page",
      "/docs/not-a-page",
      "/docs/not-a-page.mdx",
      "/discord-embed/not-a-page",
      "/docs-og/not-a-page/image.png",
    ]) {
      const response = await request(path);
      assert.equal(response.status, 404, path);
      await response.body?.cancel();
    }
  },
);
