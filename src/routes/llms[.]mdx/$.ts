import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms.mdx/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { markdownResponse } = await import("@/lib/markdown-response");
        return markdownResponse(params._splat, request);
      },
    },
  },
});
