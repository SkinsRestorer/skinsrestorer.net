import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { searchDocs } = await import("@/lib/docs-search");
        return searchDocs(request);
      },
    },
  },
});
