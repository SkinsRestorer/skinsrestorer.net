import { createFromSource } from "fumadocs-core/search/server";
import { source } from "./source";

const searchAPI = createFromSource(source, {
  language: "english",
  search: { groupBy: { properties: ["page_id"], maxResult: 3 } },
});

export async function searchDocs(request: Request) {
  const query = new URL(request.url).searchParams.get("query");
  if (!query) return Response.json([]);
  return Response.json(await searchAPI.search(query, { limit: 24 }));
}
