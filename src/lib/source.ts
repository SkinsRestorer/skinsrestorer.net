import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

import { docFileInfo, locales, type Locale, i18n } from "./i18n";

export const source = loader({
  i18n,
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [
    ...(page.locale && page.locale !== "en" ? [page.locale] : []),
    ...page.slugs,
    "image.png",
  ];

  return {
    segments,
    url: `/docs-og/${segments.join("/")}`,
  };
}

/** Only real translations belong in hreflang clusters and the sitemap. */
export function getDocLanguages(slugs: string[]): Locale[] {
  return locales.filter((locale) => {
    const page = source.getPage(slugs, locale);
    return page && docFileInfo(page.path).locale === locale;
  });
}
