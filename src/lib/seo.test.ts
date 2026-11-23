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
    const website = script["script:ld+json"]["@graph"][0];
    assert.ok(website);
    assert.equal(website["@id"], `${siteUrl}/#website`);
    assert.equal(website.url, `${siteUrl}/`);
    assert.deepEqual(website.inLanguage, locales);
  }
});
