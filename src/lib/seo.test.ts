import assert from "node:assert/strict";
import { test } from "node:test";
import { Route as studio } from "../routes/{-$lang}/studio";
import { Route as upload } from "../routes/{-$lang}/upload";
import { Route as generator } from "../routes/{-$lang}/generator";
import { Route as pricing } from "../routes/{-$lang}/pricing";
import { locales, type Locale } from "./i18n";
import { getPageHead } from "./seo";
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
    test(`${locale} ${titleKey} uses translated search and social metadata`, async () => {
      const head = route.options.head as (context: {
        params: { lang: Locale };
      }) => ReturnType<typeof getPageHead>;
      const result = head({ params: { lang: locale } });
      const title = `${translate(locale, titleKey)} - SR`;
      const description = translate(locale, descriptionKey);
      assert.notEqual(description, descriptionKey);
      assert.ok(
        result?.meta?.some(
          (tag) => tag && "title" in tag && tag.title === title,
        ),
      );
      for (const name of ["description", "twitter:description"]) {
        assert.ok(
          result?.meta?.some(
            (tag) =>
              tag &&
              "name" in tag &&
              tag.name === name &&
              tag.content === description,
          ),
        );
      }
      assert.ok(
        result?.meta?.some(
          (tag) =>
            tag &&
            "property" in tag &&
            tag.property === "og:description" &&
            tag.content === description,
        ),
      );
      assert.ok(
        result?.meta?.some(
          (tag) =>
            tag &&
            "property" in tag &&
            tag.property === "og:title" &&
            tag.content === title,
        ),
      );
    });
  }
}
