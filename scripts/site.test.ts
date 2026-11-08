import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";
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
    assert.equal((sitemap.match(/<url>/g) ?? []).length, 74);
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
        "type" in searchIndex,
    );
    assert.equal(searchIndex.type, "advanced");
    const client = oramaStaticClient({
      from: new URL("/api/search", baseUrl).href,
      search: { limit: 24 },
    });
    const results = await client.search("skin");
    assert.ok(results.length > 0 && results.length <= 24);
    assert.ok(results.every((result) => result.url.startsWith("/docs")));
    assert.equal(search.headers.get("x-content-type-options"), "nosniff");
    assert.equal(search.headers.get("x-frame-options"), "SAMEORIGIN");

    for (const slugs of [[], ["installation"]]) {
      const key = createHash("sha1")
        .update(
          `docs-metadata__${JSON.stringify(slugs).replace(/[/\\?%*:|"<>]/g, "-")}`,
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
