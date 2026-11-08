import { createFromSource } from "fumadocs-core/search/server";
import { source } from "./source";

const searchAPI = createFromSource(source, {
  language: "english",
  search: { groupBy: { properties: ["page_id"], maxResult: 3 } },
});

export async function getDocsSearchIndex() {
  return searchAPI.staticGET();
}
