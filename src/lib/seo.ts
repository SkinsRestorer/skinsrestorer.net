import { locales, localizePath, splitLocalePath, type Locale } from "./i18n";
import { translate } from "./messages";

export const siteUrl = "https://skinsrestorer.net";
export const siteTitle = "SkinsRestorer - Minecraft Skin Plugin";
export const siteDescription =
  "SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins.";

export function getPageHead(
  path: string,
  options: {
    title?: string;
    description?: string;
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
  const title = options.title
    ? `${translate(contentLocale, options.title)} - SR`
    : translate(contentLocale, siteTitle);
  const description = translate(
    contentLocale,
    options.description ?? siteDescription,
  );
  const image = new URL(options.image ?? "/logo.png", siteUrl).href;
  const url = new URL(localizePath(bare, contentLocale), siteUrl).href;
  const alternatives =
    options.alternatives ??
    (["/", "/upload", "/generator", "/editor", "/pricing"].includes(bare)
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
