import { locales, localizePath, splitLocalePath, type Locale } from "./i18n";
import { translate, type MessageKey } from "./messages";
import { getSitePageLanguages } from "./site-pages";

export const siteUrl = "https://skinsrestorer.net";
export const siteTitleKey = "seo.siteTitle";
const siteDescriptionKey = "seo.siteDescription";
const siteName = "SkinsRestorer";
/** 1200x630 share image for pages without their own image. */
export const defaultShareImage = "/og-image.png";

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
    ? pageTitle.includes(siteName)
      ? pageTitle
      : `${pageTitle} - ${siteName}`
    : translate(contentLocale, siteTitleKey);
  const description = options.descriptionKey
    ? translate(contentLocale, options.descriptionKey)
    : (options.description ?? translate(contentLocale, siteDescriptionKey));
  const image = new URL(options.image ?? defaultShareImage, siteUrl).href;
  const url = new URL(localizePath(bare, contentLocale), siteUrl).href;
  const alternatives = options.alternatives ?? getSitePageLanguages(bare);
  const docs = bare === "/docs" || bare.startsWith("/docs/");
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      // Overrides the root route's "website" for guides.
      ...(docs ? [{ property: "og:type", content: "article" }] : []),
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
      { name: "twitter:card", content: "summary_large_image" },
      ...(bare === "/"
        ? [
            {
              "script:ld+json": getHomeStructuredData(url, description),
            },
          ]
        : []),
    ],
    links: [
      { rel: "canonical", href: url },
      // Agents can read the same guide as Markdown.
      ...(docs
        ? [{ rel: "alternate", type: "text/markdown", href: `${url}.mdx` }]
        : []),
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

/** Describes the site and the plugin for search engines on the home page. */
function getHomeStructuredData(url: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: siteName,
        url: `${siteUrl}/`,
        inLanguage: locales,
      },
      {
        "@type": "SoftwareApplication",
        name: siteName,
        description,
        url,
        applicationCategory: "GameApplication",
        operatingSystem: "Java",
        license: "https://www.gnu.org/licenses/gpl-3.0.html",
        image: new URL("/logo.png", siteUrl).href,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        sameAs: [
          "https://github.com/SkinsRestorer/SkinsRestorer",
          "https://modrinth.com/plugin/skinsrestorer",
          "https://www.spigotmc.org/resources/skinsrestorer.2124",
        ],
      },
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
