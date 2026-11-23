import { defineI18n } from "fumadocs-core/i18n";

export const locales = ["en", "ru", "es", "pt-BR"] as const;
export type Locale = (typeof locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  es: "Español",
  "pt-BR": "Português (Brasil)",
};
export const i18n = defineI18n({
  defaultLanguage: "en",
  languages: [...locales],
  hideLocale: "default-locale",
  fallbackLanguage: "en",
});

export function isLocale(value: string | undefined): value is Locale {
  return locales.some((locale) => locale === value);
}

/** The URL owns the locale, including during SSR. Never use a module global. */
export function splitLocalePath(pathname: string): {
  locale: Locale;
  path: string;
} {
  const [first, ...rest] = pathname.replace(/^\//u, "").split("/");
  return isLocale(first)
    ? { locale: first, path: `/${rest.join("/")}`.replace(/\/$/u, "") || "/" }
    : { locale: "en", path: pathname.replace(/\/$/u, "") || "/" };
}

export function localizePath(path: string, locale: Locale): string {
  const url = new URL(path, "https://skinsrestorer.net");
  const bare = splitLocalePath(url.pathname).path;
  const localized =
    locale === "en" ? bare : `/${locale}${bare === "/" ? "" : bare}`;
  return `${localized}${url.search}${url.hash}`;
}

/** The path of `href` without its locale, query, or hash. */
export function pagePath(href: string): string {
  const [pathname = ""] = href.split(/[?#]/u);
  return splitLocalePath(pathname).path;
}

/** Legal text and service endpoints remain at their existing English URLs. */
export function hasLocalizedPages(href: string): boolean {
  const path = pagePath(href);
  return (
    path === "/" ||
    [
      "/studio",
      "/upload",
      "/generator",
      "/editor",
      "/pricing",
      "/docs",
      "/docs.mdx",
    ].includes(path) ||
    path.startsWith("/docs/")
  );
}

export type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

/** Local storage, or undefined where the browser blocks it. */
export function browserStorage(): PreferenceStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

const lastLocaleKey = "skinsrestorer:locale";

/** The locale of the last localized page that this browser showed. */
export function lastLocale(
  storage: PreferenceStorage | undefined,
): Locale | undefined {
  try {
    const value = storage?.getItem(lastLocaleKey) ?? undefined;
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function rememberLocale(
  storage: PreferenceStorage | undefined,
  locale: Locale,
): void {
  try {
    storage?.setItem(lastLocaleKey, locale);
  } catch {
    // English-only pages then link to English pages.
  }
}

export function localizeHref(href: string, locale: Locale): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  return hasLocalizedPages(href) ? localizePath(href, locale) : href;
}

const docFilePattern = new RegExp(
  `^(.*?)(?:\\.(${locales.join("|")}))?\\.mdx?$`,
  "u",
);

/** Parse Fumadocs' dot convention without treating the locale as a slug. */
export function docFileInfo(file: string) {
  const match = docFilePattern.exec(file.replaceAll("\\", "/"));
  if (!match) throw new Error(`Invalid documentation file: ${file}`);
  const [, name = "", suffix] = match;
  const locale: Locale = isLocale(suffix) ? suffix : "en";
  const slug = name.replace(/(^|\/)index$/u, "");
  const path = `/docs/${slug}`.replace(/\/$/u, "");
  return { locale, path, slugs: slug.split("/").filter(Boolean) };
}
