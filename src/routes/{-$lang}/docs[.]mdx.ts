import { isLocale } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/{-$lang}/docs.mdx")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { markdownResponse } = await import("@/lib/markdown-response");
        if (params.lang && !isLocale(params.lang))
          return new Response(null, { status: 404 });
        return markdownResponse(
          undefined,
          request,
          isLocale(params.lang) ? params.lang : "en",
        );
      },
    },
  },
});
