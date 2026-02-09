import type { MetadataRoute } from "next";
import { i18n } from "@/lib/i18n";
import { source } from "@/lib/source";

function languageAlternates(enPath: string): Record<string, string> {
  const alternates: Record<string, string> = {};
  for (const lang of i18n.languages) {
    if (lang === i18n.defaultLanguage) {
      alternates[lang] = `https://skinsrestorer.net${enPath}`;
    } else {
      alternates[lang] = `https://skinsrestorer.net/${lang}${enPath}`;
    }
  }
  return alternates;
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...(process.env.SITEMAP_PAGES || "").split("|").map(
      (page) =>
        ({
          url: `https://skinsrestorer.net${page}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.7,
          alternates: {
            languages: languageAlternates(page),
          },
        }) satisfies MetadataRoute.Sitemap[number],
    ),
    ...source.getPages().map((page) => {
      const { lastModified } = page.data;
      return {
        url: `https://skinsrestorer.net${page.url}`,
        lastModified: lastModified ? new Date(lastModified) : undefined,
        changeFrequency: "weekly",
        priority: 0.5,
        alternates: {
          languages: languageAlternates(page.url),
        },
      } satisfies MetadataRoute.Sitemap[number];
    }),
  ];
}
