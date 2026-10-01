import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const searchAPI = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: "english",
  search: {
    groupBy: { properties: ["page_id"], maxResult: 3 },
  },
});

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query");
  if (!query) return Response.json([]);

  return Response.json(await searchAPI.search(query, { limit: 24 }));
}
