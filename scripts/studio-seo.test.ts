import assert from "node:assert/strict";
import { test } from "node:test";

const baseUrl = process.env.SITE_TEST_URL;
const siteUrl = "https://skinsrestorer.net";
const languages = ["en", "ru", "es", "pt-BR"] as const;
const entryPaths = ["/studio", "/upload", "/generator"] as const;

function localized(path: string, language: string) {
  return language === "en" ? path : `/${language}${path}`;
}

function attribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
}

function languageLinks(markup: string) {
  return Object.fromEntries(
    [...markup.matchAll(/<(?:\w+:)?link\b[^>]*>/gi)]
      .map(([tag]) => [attribute(tag, "hreflang"), attribute(tag, "href")])
      .filter(([language]) => language),
  );
}

function expectedAlternatives(path: string) {
  return {
    ...Object.fromEntries(
      languages.map((language) => [
        language,
        siteUrl + localized(path, language),
      ]),
    ),
    "x-default": siteUrl + path,
  };
}

void test(
  "Studio preserves distinct localized entry pages and search metadata",
  { skip: !baseUrl, timeout: 30_000 },
  async () => {
    const request = (path: string) =>
      fetch(new URL(path, baseUrl), {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    const pages = await Promise.all(
      languages.flatMap((language) =>
        entryPaths.map(async (entry) => {
          const path = localized(entry, language);
          const response = await request(
            `${path}?handoff=preview-test&intent=createcustom`,
          );
          assert.equal(response.status, 200, path);
          const html = await response.text();
          const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
          assert.ok(head, `Missing server-rendered head: ${path}`);
          assert.equal(
            attribute(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang"),
            language,
            path,
          );
          const canonical = [...head.matchAll(/<link\b[^>]*>/gi)]
            .map(([tag]) => ({
              rel: attribute(tag, "rel"),
              href: attribute(tag, "href"),
            }))
            .filter((link) => link.rel === "canonical");
          assert.deepEqual(
            canonical,
            [{ rel: "canonical", href: siteUrl + path }],
            path,
          );
          assert.deepEqual(
            languageLinks(head),
            expectedAlternatives(entry),
            path,
          );
          const meta = Object.fromEntries(
            [...head.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => [
              attribute(tag, "name") ?? attribute(tag, "property"),
              attribute(tag, "content"),
            ]),
          );
          assert.equal(meta["og:url"], siteUrl + path, path);
          assert.ok(meta.description, `Missing description: ${path}`);
          const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
          assert.ok(title, `Missing title: ${path}`);
          return { language, entry, title, description: meta.description };
        }),
      ),
    );
    for (const language of languages) {
      const variants = pages.filter((page) => page.language === language);
      assert.equal(
        new Set(variants.map((page) => page.title)).size,
        entryPaths.length,
        `Entry titles must describe different tasks: ${language}`,
      );
      assert.equal(
        new Set(variants.map((page) => page.description)).size,
        entryPaths.length,
        `Entry descriptions must describe different tasks: ${language}`,
      );
    }

    const texture =
      "26c156a5a28ba3647b3de3b5bfec4d399670b1f063d6526ba201c2be01b60df5";
    for (const language of languages) {
      const response = await request(
        `${localized("/editor", language)}?texture=${texture}`,
      );
      assert.ok([301, 308].includes(response.status), language);
      const location = response.headers.get("location");
      assert.ok(location, language);
      const destination = new URL(location, baseUrl);
      assert.equal(destination.pathname, localized("/studio", language));
      assert.equal(destination.searchParams.get("texture"), texture);
      await response.body?.cancel();
    }

    const sitemapResponse = await request("/sitemap.xml");
    assert.equal(sitemapResponse.status, 200);
    const sitemap = await sitemapResponse.text();
    const entries = new Map(
      [...sitemap.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)].map(
        ([, markup]) => [markup.match(/<loc>(.*?)<\/loc>/)?.[1], markup],
      ),
    );
    for (const language of languages) {
      for (const path of entryPaths) {
        const url = siteUrl + localized(path, language);
        const entry = entries.get(url);
        assert.ok(entry, `Missing sitemap entry: ${url}`);
        assert.deepEqual(languageLinks(entry), expectedAlternatives(path), url);
      }
      assert.ok(!entries.has(siteUrl + localized("/editor", language)));
    }
    for (const url of entries.keys()) {
      assert.ok(url && !new URL(url).search, `Query URL in sitemap: ${url}`);
    }
  },
);
