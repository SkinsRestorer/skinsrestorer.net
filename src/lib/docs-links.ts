import { posix } from "node:path";
import { localizeHref, localizePath, type Locale } from "./i18n";

export interface ResolvedLink {
  url: string;
  title: string;
  description?: string;
}

interface LinkSource {
  getPageByHref: (
    href: string,
    options: { dir?: string; language: Locale },
  ) =>
    | {
        page: {
          url: string;
          data: {
            title?: string | undefined;
            description?: string | undefined;
          };
        };
        hash?: string;
      }
    | undefined;
}

/**
 * Resolve the docs links on a page for hover previews. Content links use
 * English site paths, while page URLs in other locales carry a locale prefix,
 * so look absolute links up by their localized path.
 */
export function resolveDocLinks(
  source: LinkSource,
  page: { path: string; data: { extractedReferences: { href: string }[] } },
  locale: Locale,
): Record<string, ResolvedLink> {
  const links: Record<string, ResolvedLink> = {};
  for (const { href } of page.data.extractedReferences) {
    const found = source.getPageByHref(
      href.startsWith("/") ? localizeHref(href, locale) : href,
      { dir: posix.dirname(page.path), language: locale },
    );
    if (!found) continue;
    const url = localizePath(found.page.url, locale);
    links[href] = {
      url: found.hash ? `${url}#${found.hash}` : url,
      title: found.page.data.title ?? "",
      ...(found.page.data.description === undefined
        ? {}
        : { description: found.page.data.description }),
    };
  }
  return links;
}
