import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs.mdx")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { markdownResponse } = await import("@/lib/markdown-response");
        return markdownResponse(undefined, request);
      },
    },
  },
});
