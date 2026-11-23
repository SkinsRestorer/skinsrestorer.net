import { createFileRoute } from "@tanstack/react-router";
import { isLocale } from "@/lib/i18n";

export const Route = createFileRoute("/api/docs-tree/$lang")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!isLocale(params.lang)) return new Response(null, { status: 404 });
        const { serializeDocsTree } = await import("@/lib/source");
        return Response.json(await serializeDocsTree(params.lang));
      },
    },
  },
});
