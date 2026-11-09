import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { source } = await import("@/lib/source");
        const scanned = ["# Docs"];
        const map = new Map<string, string[]>();
        for (const page of source.getPages("en")) {
          const dir = page.slugs[0] ?? "Overview";
          const list = map.get(dir) ?? [];
          list.push(
            `- [${page.data.title}](${page.url}): ${page.data.description}`,
          );
          map.set(dir, list);
        }
        for (const [key, value] of map) {
          scanned.push(`## ${key}`, value.join("\n"));
        }
        return new Response(scanned.join("\n\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
