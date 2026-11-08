import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          "User-agent: *\nAllow: /\n\nSitemap: https://skinsrestorer.net/sitemap.xml\n",
          {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        ),
    },
  },
});
