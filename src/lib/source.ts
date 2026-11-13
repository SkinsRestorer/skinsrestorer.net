import { docs } from "fumadocs-mdx:collections/server";
import {
  type InferPageType,
  type LoaderOutput,
  type Meta,
  type Page,
  loader,
} from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";

import { docFileInfo, locales, type Locale, i18n } from "./i18n";

// Fumadocs 16.19 widens static source inference. The loader retains the MDX
// entries, including their front matter, methods, and generated metadata.
export const source = loader(docs.toFumadocsSource(), {
  i18n,
  baseUrl: "/docs",
  plugins: [lucideIconsPlugin()],
}) as LoaderOutput<{
  page: Page<undefined, (typeof docs.docs)[number]>;
  meta: Meta<undefined, (typeof docs.meta)[number]>;
  i18n: typeof i18n;
}>;

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
