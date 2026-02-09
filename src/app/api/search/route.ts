import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

export const { GET } = createFromSource(source, {
  localeMap: {
    // https://docs.orama.com/docs/orama-js/supported-languages
    en: "english",
    de: "german",
  },
});
