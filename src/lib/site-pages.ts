/** Public HTML pages, shared by the sitemap and documentation link checker. */
import { locales, localizePath } from "./i18n.ts";

export const sitePages = [
  "/",
  "/upload",
  "/generator",
  "/editor",
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
      ["/", "/upload", "/generator", "/editor", "/pricing"].map((path) =>
        localizePath(path, locale),
      ),
    ),
];
