import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async () => {
        const { getDocsSearchIndex } = await import("@/lib/docs-search");
        return getDocsSearchIndex();
      },
    },
  },
});
