import { locales, type Locale } from "../i18n";
import { registerMessages, type Catalog } from ".";
import en from "./en.json";
import es from "./es.json";
import ptBR from "./pt-BR.json";
import ru from "./ru.json";

/**
 * Every catalog, loaded eagerly. Import it only on the server, in tools, and
 * in tests: browsers load one catalog at a time through `loadMessages`.
 */
export const catalogs = { en, ru, es, "pt-BR": ptBR } satisfies Record<
  Locale,
  Catalog
>;

for (const locale of locales) registerMessages(locale, catalogs[locale]);
