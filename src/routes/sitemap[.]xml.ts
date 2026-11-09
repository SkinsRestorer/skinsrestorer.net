import { createFileRoute } from "@tanstack/react-router";
import { localizedSitePages } from "@/lib/site-pages";
import { siteUrl, getLanguageAlternates } from "@/lib/seo";
import { docFileInfo, locales, splitLocalePath } from "@/lib/i18n";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { source, getDocLanguages } = await import("@/lib/source");
        const urls = [
          ...localizedSitePages.map((path) => ({
            path,
            lastModified: undefined as Date | undefined,
            languages: [
              "/privacy-policy",
              "/cookie-policy",
              "/terms-of-service",
            ].includes(path)
              ? ["en" as const]
              : locales,
          })),
          ...source
            .getLanguages()
            .flatMap(({ language, pages }) =>
              pages.filter(
                (page) => docFileInfo(page.path).locale === language,
              ),
            )
            .map((page) => ({
              path: page.url,
              lastModified: page.data.lastModified,
              languages: getDocLanguages(page.slugs),
            })),
        ];
        const entries = urls.map(
          ({ path, lastModified, languages }) =>
            `<url><loc>${new URL(path, siteUrl).href}</loc>${lastModified ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>` : ""}${getLanguageAlternates(
              splitLocalePath(path).path,
              languages,
            )
              .map(
                ({ language, href }) =>
                  `<xhtml:link rel="alternate" hreflang="${language}" href="${href}"/>`,
              )
              .join("")}</url>`,
        );
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join("")}</urlset>`,
          {
            headers: { "Content-Type": "application/xml; charset=utf-8" },
          },
        );
      },
    },
  },
});
