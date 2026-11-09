/** Public HTML pages, shared by the sitemap and documentation link checker. */
import { locales, localizePath } from "./i18n.ts";

export const sitePages = [
  "/",
  "/studio",
  "/upload",
  "/generator",
  "/pricing",
  "/privacy-policy",
  "/terms-of-service",
  "/cookie-policy",
] as const;

export const localizedSitePages = [
  ...sitePages,
  ...locales
    .filter((locale) => locale !== "en")
    .flatMap((locale) =>
      ["/", "/studio", "/upload", "/generator", "/pricing"].map((path) =>
        localizePath(path, locale),
      ),
    ),
];
