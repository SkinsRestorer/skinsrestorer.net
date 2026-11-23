import { createFileRoute } from "@tanstack/react-router";
import { isLocale } from "@/lib/i18n";

export const Route = createFileRoute("/api/search/$lang")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isLocale(params.lang)) return new Response(null, { status: 404 });
        const { getDocsSearchIndex } = await import("@/lib/docs-search");
        return getDocsSearchIndex(params.lang);
      },
    },
  },
});
