import { isLocale, type Locale } from "./i18n";

/**
 * The site locale that best matches the browser's preferred languages, if
 * it differs from the page's locale. The first supported language wins, so a
 * browser that prefers English before Russian gets no suggestion on English
 * pages.
 */
export function suggestedLocale(
  languages: readonly string[],
  current: Locale,
): Locale | undefined {
  for (const language of languages) {
    const locale = siteLocale(language);
    if (!locale) continue;
    return locale === current ? undefined : locale;
  }
  return undefined;
}

function siteLocale(language: string): Locale | undefined {
  const tag = language.toLowerCase();
  if (tag.startsWith("pt")) return "pt-BR";
  const base = tag.split("-")[0];
  return isLocale(base) ? base : undefined;
}
