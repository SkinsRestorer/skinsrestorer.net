import { locales, localizePath, splitLocalePath, type Locale } from "./i18n";
import { translate, type MessageKey } from "./messages";

export const siteUrl = "https://skinsrestorer.net";
export const siteTitleKey = "seo.siteTitle";
export const siteDescriptionKey = "seo.siteDescription";

export function getPageHead(
  path: string,
  options: {
    title?: string;
    titleKey?: MessageKey;
    description?: string;
    descriptionKey?: MessageKey;
    image?: string;
    locale?: Locale;
    alternatives?: readonly Locale[];
    contentLocale?: Locale;
  } = {},
) {
  const { path: bare, locale: pathLocale } = splitLocalePath(
    new URL(path, siteUrl).pathname,
  );
  const locale = options.locale ?? pathLocale;
  const contentLocale = options.contentLocale ?? locale;
  const pageTitle = options.titleKey
    ? translate(contentLocale, options.titleKey)
    : options.title;
  const title = pageTitle
    ? `${pageTitle} - SR`
    : translate(contentLocale, siteTitleKey);
  const description = options.descriptionKey
    ? translate(contentLocale, options.descriptionKey)
    : (options.description ?? translate(contentLocale, siteDescriptionKey));
  const image = new URL(options.image ?? "/logo.png", siteUrl).href;
  const url = new URL(localizePath(bare, contentLocale), siteUrl).href;
  const alternatives =
    options.alternatives ??
    (["/", "/studio", "/upload", "/generator", "/pricing"].includes(bare)
      ? locales
      : ["en"]);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      {
        property: "og:locale",
        content: { en: "en_US", ru: "ru_RU", es: "es_ES", "pt-BR": "pt_BR" }[
          contentLocale
        ],
      },
      { property: "og:image", content: image },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      {
        name: "twitter:card",
        content: options.image ? "summary_large_image" : "summary",
      },
    ],
    links: [
      { rel: "canonical", href: url },
      ...getLanguageAlternates(bare, alternatives).map(
        ({ language, href }) => ({
          rel: "alternate",
          hrefLang: language,
          href,
        }),
      ),
    ],
  };
}

export function getLanguageAlternates(
  path: string,
  languages: readonly Locale[],
) {
  return [
    ...languages.map((language) => ({
      language,
      href: new URL(localizePath(path, language), siteUrl).href,
    })),
    {
      language: "x-default",
      href: new URL(localizePath(path, "en"), siteUrl).href,
    },
  ];
}
