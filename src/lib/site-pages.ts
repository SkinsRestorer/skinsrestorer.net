/** Public HTML pages, shared by the sitemap and documentation link checker. */
import { locales, localizePath, type Locale } from "./i18n.ts";

/** Pages with a copy in every locale. The legal pages are English only. */
const translatedSitePages: readonly string[] = [
  "/",
  "/studio",
  "/upload",
  "/generator",
  "/pricing",
];

/** The languages of a page outside the docs, given its path without a locale. */
export function getSitePageLanguages(path: string): readonly Locale[] {
  return translatedSitePages.includes(path) ? locales : ["en"];
}

export const localizedSitePages = [
  ...translatedSitePages,
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
  ...locales
    .filter((locale) => locale !== "en")
    .flatMap((locale) =>
      translatedSitePages.map((path) => localizePath(path, locale)),
    ),
];
