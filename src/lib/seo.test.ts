import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Route as studio } from "../routes/{-$lang}/studio";
import { Route as upload } from "../routes/{-$lang}/upload";
import { Route as generator } from "../routes/{-$lang}/generator";
import { Route as pricing } from "../routes/{-$lang}/pricing";
import { locales, type Locale } from "./i18n";
import { defaultShareImage, getPageHead, siteUrl } from "./seo";
import { translate } from "./messages";

const pages = [
  [studio, "studio.title", "seo.studioDescription"],
  [upload, "upload.title", "seo.uploadDescription"],
  [generator, "generator.title", "generator.description"],
  [
    pricing,
    "pricing.pricing",
    "pricing.skinsrestorerFreeOpenSourceSupportDevelopmentGet",
  ],
] as const;

for (const locale of locales) {
  for (const [route, titleKey, descriptionKey] of pages) {
    test(`${locale} ${titleKey} uses translated search and social metadata`, () => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The page heads read only `params`; a full TanStack head context needs a running router.
      const head = route.options.head as (context: {
        params: { lang: Locale };
      }) => ReturnType<typeof getPageHead>;
      const result = head({ params: { lang: locale } });
      const title = `${translate(locale, titleKey)} - SkinsRestorer`;
      const description = translate(locale, descriptionKey);
      assert.notEqual(description, descriptionKey);
      assert.ok(
        result.meta.some((tag) => "title" in tag && tag.title === title),
      );
      for (const name of ["description", "twitter:description"]) {
        assert.ok(
          result.meta.some(
            (tag) =>
              "name" in tag && tag.name === name && tag.content === description,
          ),
        );
      }
      assert.ok(
        result.meta.some(
          (tag) =>
            "property" in tag &&
            tag.property === "og:description" &&
            tag.content === description,
        ),
      );
      assert.ok(
        result.meta.some(
          (tag) =>
            "property" in tag &&
            tag.property === "og:title" &&
            tag.content === title,
        ),
      );
    });
  }
}

function meta(head: ReturnType<typeof getPageHead>, key: string) {
  for (const tag of head.meta) {
    if ("name" in tag && tag.name === key) return tag.content;
    if ("property" in tag && tag.property === key) return tag.content;
    if (key === "title" && "title" in tag) return tag.title;
  }
  return undefined;
}

test("page titles end with the full site name once", () => {
  assert.equal(
    meta(getPageHead("/docs/x", { title: "Firewall" }), "title"),
    "Firewall - SkinsRestorer",
  );
  assert.equal(
    meta(getPageHead("/docs/x", { title: "Install SkinsRestorer" }), "title"),
    "Install SkinsRestorer",
  );
});

test("pages without their own image share a large 1200x630 image", () => {
  const head = getPageHead("/studio");
  const image = new URL(defaultShareImage, siteUrl).href;
  assert.equal(meta(head, "og:image"), image);
  assert.equal(meta(head, "twitter:image"), image);
  assert.equal(meta(head, "twitter:card"), "summary_large_image");
  // A PNG stores its width and height as big-endian integers in the IHDR chunk.
  const png = readFileSync(
    new URL(`../../public${defaultShareImage}`, import.meta.url),
  );
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test("the home page describes one multilingual website at the root URL", () => {
  for (const locale of locales) {
    const head = getPageHead("/", { locale });
    const script = head.meta.find((tag) => "script:ld+json" in tag);
    assert.ok(script && "script:ld+json" in script);
    const data = script["script:ld+json"];
    assert.ok("@graph" in data);
    const website = data["@graph"][0];
    assert.ok(website);
    assert.equal(website["@id"], `${siteUrl}/#website`);
    assert.equal(website.url, `${siteUrl}/`);
    assert.deepEqual(website.inLanguage, locales);
  }
});

test("guides are articles with a Markdown copy in the language of their text", () => {
  const head = getPageHead("/es/docs/installation", { contentLocale: "es" });
  assert.equal(meta(head, "og:type"), "article");
  assert.deepEqual(
    head.links.find((link) => "type" in link && link.type === "text/markdown"),
    {
      rel: "alternate",
      type: "text/markdown",
      href: `${siteUrl}/es/docs/installation.mdx`,
    },
  );
  const fallback = getPageHead("/es/docs/development", { contentLocale: "en" });
  assert.ok(
    fallback.links.some(
      (link) => link.href === `${siteUrl}/docs/development.mdx`,
    ),
  );
});

test("pages outside the docs keep the site type and have no Markdown copy", () => {
  const head = getPageHead("/studio");
  assert.equal(meta(head, "og:type"), undefined);
  assert.ok(!head.links.some((link) => "type" in link));
});

function hrefLanguages(path: string) {
  return getPageHead(path)
    .links.filter((link) => "hrefLang" in link)
    .map((link) => ("hrefLang" in link ? link.hrefLang : undefined));
}

test("legal pages list only English, translated pages list every locale", () => {
  assert.deepEqual(hrefLanguages("/privacy-policy"), ["en", "x-default"]);
  assert.deepEqual(hrefLanguages("/ru/pricing"), [...locales, "x-default"]);
});

test("guides describe their section path as a breadcrumb list", () => {
  const head = getPageHead("/ru/docs/installation/proxy", {
    breadcrumbs: [
      { name: "Документация", url: "/ru/docs" },
      { name: "Установка", url: "/ru/docs/installation" },
      { name: "Прокси", url: "/ru/docs/installation/proxy" },
    ],
  });
  const script = head.meta.find((tag) => "script:ld+json" in tag);
  assert.ok(script && "script:ld+json" in script);
  assert.deepEqual(script["script:ld+json"], {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ["Документация", "/ru/docs"],
      ["Установка", "/ru/docs/installation"],
      ["Прокси", "/ru/docs/installation/proxy"],
    ].map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${siteUrl}${path}`,
    })),
  });
  // The docs home has no ancestors to show.
  const home = getPageHead("/docs", {
    breadcrumbs: [{ name: "Docs", url: "/docs" }],
  });
  assert.ok(!home.meta.some((tag) => "script:ld+json" in tag));
});
