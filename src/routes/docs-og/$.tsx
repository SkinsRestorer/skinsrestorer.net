import { isLocale } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs-og/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [{ generateDocsImage }, { source }] = await Promise.all([
          import("@/lib/docs-og"),
          import("@/lib/source"),
        ]);
        const segments = params._splat?.split("/") ?? [];
        if (segments.pop() !== "image.png")
          return new Response(null, { status: 404 });
        const locale = isLocale(segments[0]) ? segments.shift() : "en";
        const page = source.getPage(segments, locale);
        if (!page) return new Response(null, { status: 404 });
        return generateDocsImage({
          title: page.data.title,
          description: page.data.description,
        });
      },
    },
  },
});
