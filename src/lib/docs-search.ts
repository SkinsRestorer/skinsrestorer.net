import { createFromSource } from "fumadocs-core/search/server";
import { source } from "./source";

const searchAPI = createFromSource(source, {
  localeMap: {
    en: { language: "english" },
    ru: { language: "russian" },
    es: { language: "spanish" },
    "pt-BR": { language: "portuguese" },
  },
  search: { groupBy: { properties: ["page_id"], maxResult: 3 } },
});

export async function getDocsSearchIndex() {
  return searchAPI.staticGET();
}
