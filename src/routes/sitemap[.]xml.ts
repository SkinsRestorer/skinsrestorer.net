import { createFileRoute } from "@tanstack/react-router";
import { sitePages } from "@/lib/site-pages";
import { siteUrl } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { source } = await import("@/lib/source");
        const urls = [
          ...sitePages.map((path) => ({
            path,
            lastModified: undefined as Date | undefined,
          })),
          ...source.getPages().map((page) => ({
            path: page.url,
            lastModified: page.data.lastModified,
          })),
        ];
        const entries = urls.map(
          ({ path, lastModified }) =>
            `<url><loc>${new URL(path, siteUrl).href}</loc>${lastModified ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>` : ""}</url>`,
        );
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`,
          {
            headers: { "Content-Type": "application/xml; charset=utf-8" },
          },
        );
      },
    },
  },
});
