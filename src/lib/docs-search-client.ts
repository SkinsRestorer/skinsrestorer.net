import { create, type Language } from "@orama/orama";
import { oramaStaticClient } from "fumadocs-core/search/client/orama-static";
import type { Locale } from "./i18n";

export const searchLanguages: Record<Locale, Language> = {
  en: "english",
  ru: "russian",
  es: "spanish",
  "pt-BR": "portuguese",
};

/** Match the server tokenizer when loading each exported locale database. */
export function createDocsSearchClient(locale: Locale, from = "/api/search") {
  return oramaStaticClient({
    from,
    locale,
    search: { limit: 24 },
    initOrama: (language) =>
      create({
        schema: { _: "string" },
        language: searchLanguages[language as Locale] ?? "english",
      }),
  });
}
