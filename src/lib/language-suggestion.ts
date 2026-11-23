import {
  hasLocalizedPages,
  isLocale,
  splitLocalePath,
  type Locale,
} from "./i18n";

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

/**
 * Whether the page at `href` exists in `target`. Docs pages are translated
 * one by one, so they need the locales their route loader lists as
 * `alternatives`. Other localized pages exist in every locale.
 */
export function pageHasLocale(
  href: string,
  target: Locale,
  matches: readonly { readonly loaderData?: unknown }[],
): boolean {
  if (!hasLocalizedPages(href)) return false;
  const [pathname = ""] = href.split(/[?#]/u);
  const path = splitLocalePath(pathname).path;
  if (path !== "/docs" && !path.startsWith("/docs/")) return true;
  return matches.some(({ loaderData }) => {
    if (typeof loaderData !== "object" || loaderData === null) return false;
    if (!("alternatives" in loaderData)) return false;
    const { alternatives } = loaderData;
    return Array.isArray(alternatives) && alternatives.includes(target);
  });
}
