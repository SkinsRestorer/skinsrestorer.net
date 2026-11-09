import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createDocsSearchClient } from "../src/lib/docs-search-client";
import { isLocale } from "../src/lib/i18n";
import { fromJSON } from "seroval";

// Run against `bun run preview` with `bun run test:site` after building.
const baseUrl = process.env.SITE_TEST_URL;

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
      ["/generator", "Custom Skin Generator"],
      ["/upload", "Skin Upload"],
      ["/editor", "Skin editor"],
      ["/pricing", "Simple, transparent pricing"],
      ["/privacy-policy", "Privacy Policy"],
      ["/terms-of-service", "Terms of Service"],
      ["/cookie-policy", "Cookie Policy"],
      ["/docs", "SkinsRestorer documentation"],
      ["/docs/installation", "Install SkinsRestorer"],
    ]) {
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
        /text\/html/,
        path,
      );
      const html = await response.text();
      const title = html
        .match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]
        .replace(/<[^>]+>/g, "")
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
    ]) {
      const response = await request(`/${locale}/upload?handoff=example`);
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
      assert.ok(!html.match(/rel="canonical"[^>]+handoff/));
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
    }

    const docs = await (await request("/docs/installation")).text();
    assert.ok(docs.includes("Install SkinsRestorer - SR"));
    assert.ok(
      docs.includes("https://skinsrestorer.net/docs-og/installation/image.png"),
    );
    assert.ok(docs.includes("discord:component-embed"));

    for (const path of [
      "/docs.mdx",
      "/llms.mdx",
      "/docs/installation.mdx",
      "/llms.mdx/installation",
    ]) {
      const response = await request(path);
      assert.equal(response.status, 200, path);
      assert.match(
        response.headers.get("content-type") ?? "",
        /text\/markdown/,
        path,
      );
      assert.match(await response.text(), /^# .+\nURL: \/docs/);
      const head = await request(path, { method: "HEAD" });
      assert.equal(head.status, 200, `HEAD ${path}`);
      assert.equal(await head.text(), "");
    }

    const index = await (await request("/llms.txt")).text();
    assert.ok(index.includes("/docs/installation"));
    const full = await (await request("/llms-full.txt")).text();
    assert.ok(full.includes("# Install SkinsRestorer"));
    assert.ok(full.includes("Reviewed:"));
    assert.match(
      await (await request("/robots.txt")).text(),
      /Sitemap: https:\/\/skinsrestorer.net\/sitemap.xml/,
    );
    const sitemap = await (await request("/sitemap.xml")).text();
    assert.equal((sitemap.match(/<url>/g) ?? []).length, 104);
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

    const search = await request("/api/search");
    assert.ok(search.headers.has("etag"));
    const searchIndex = await search.json();
    assert.ok(
      typeof searchIndex === "object" &&
        searchIndex !== null &&
        "type" in searchIndex &&
        "data" in searchIndex &&
        typeof searchIndex.data === "object" &&
        searchIndex.data !== null,
    );
    assert.equal(searchIndex.type, "i18n");
    assert.deepEqual(Object.keys(searchIndex.data).sort(), [
      "en",
      "es",
      "pt-BR",
      "ru",
    ]);
    const client = createDocsSearchClient(
      "en",
      new URL("/api/search", baseUrl).href,
    );
    const results = await client.search("skin");
    assert.ok(results.length > 0 && results.length <= 24);
    assert.ok(results.every((result) => result.url.startsWith("/docs")));
    for (const [locale, query] of [
      ["ru", "скин"],
      ["es", "skin"],
      ["pt-BR", "skin"],
    ]) {
      assert.ok(isLocale(locale));
      const localizedClient = createDocsSearchClient(
        locale,
        new URL("/api/search", baseUrl).href,
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
      const key = createHash("sha1")
        .update(
          `docs-metadata__${JSON.stringify(["en", ...slugs]).replace(/[/\\?%*:|"<>]/g, "-")}`,
        )
        .digest("hex");
      const response = await request(`/__tsr/staticServerFnCache/${key}.json`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.has("etag"));
      const metadata = fromJSON(await response.json()) as {
        result: { url: string; title: string; pageTree: unknown };
      };
      assert.equal(
        metadata.result.url,
        `/docs${slugs.length ? `/${slugs.join("/")}` : ""}`,
      );
      assert.ok(metadata.result.title);
      assert.ok(metadata.result.pageTree);
    }

    const embed = await request("/discord-embed/installation");
    assert.equal(embed.status, 200);
    assert.match(embed.headers.get("content-type") ?? "", /application\/json/);
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
      ["/docs/features/skin-url", 308, "/docs/features/skin-upload"],
      ["/docs/features/skin-url.mdx", 308, "/docs/features/skin-upload.mdx"],
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
