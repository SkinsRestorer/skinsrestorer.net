import type { MetadataRoute } from "next";
import { i18n } from "@/lib/i18n";
import { source } from "@/lib/source";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...(process.env.SITEMAP_PAGES || "").split("|").flatMap(
      (page) =>
        i18n.languages.map(
          (lang) =>
            ({
              url: `https://skinsrestorer.net${lang === i18n.defaultLanguage ? "" : `/${lang}`}${page}`,
              lastModified: new Date(),
              changeFrequency: "daily",
              priority: 0.7,
            }) satisfies MetadataRoute.Sitemap[number],
        ),
    ),
    ...i18n.languages.flatMap((lang) =>
      source.getPages(lang).map((page) => {
        const { lastModified } = page.data;
        return {
          url: `https://skinsrestorer.net${page.url}`,
          lastModified: lastModified ? new Date(lastModified) : undefined,
          changeFrequency: "weekly",
          priority: 0.5,
        } satisfies MetadataRoute.Sitemap[number];
      }),
    ),
  ];
}
