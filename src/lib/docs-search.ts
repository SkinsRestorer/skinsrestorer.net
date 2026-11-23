import { createFromSource } from "fumadocs-core/search/server";
import { Schema } from "effect";
import type { Locale } from "./i18n";
import { source } from "./source";

const searchAPI = createFromSource(source, {
  // oxlint-disable-next-line typescript/no-deprecated -- removing it switches to the multilingual tokenizer and changes search results
  localeMap: {
    en: { language: "english" },
    ru: { language: "russian" },
    es: { language: "spanish" },
    "pt-BR": { language: "portuguese" },
  },
  search: { groupBy: { properties: ["page_id"], maxResult: 3 } },
});

const decodeExport = Schema.decodeUnknownSync(
  Schema.Struct({
    type: Schema.Literal("i18n"),
    data: Schema.Record(Schema.String, Schema.Unknown),
  }),
);

/** Export one locale, so the browser downloads and builds only its index. */
export async function getDocsSearchIndex(locale: Locale) {
  const exported = decodeExport(await searchAPI.export());
  return Response.json({
    type: "i18n",
    data: { [locale]: exported.data[locale] },
  });
}
