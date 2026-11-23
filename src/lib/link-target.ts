import type { AnyRouter } from "@tanstack/react-router";
import { localizeHref, type Locale } from "./i18n";

const siteOrigin = "https://skinsrestorer.net";

/**
 * Router `to` values are paths, so a query or fragment inside one becomes part
 * of the path. Return them as separate options.
 *
 * Return `undefined` for anything the router cannot reproduce exactly, so the
 * caller renders a plain anchor: other origins, relative and query-only links,
 * malformed fragments, and queries the router would rewrite.
 */
export function getLinkTarget(
  href: string,
  locale: Locale,
  options: Pick<AnyRouter["options"], "parseSearch" | "stringifySearch">,
): { to: string; search?: Record<string, unknown>; hash?: string } | undefined {
  const localized = localizeHref(href, locale);
  if (!localized.startsWith("/") || localized.startsWith("//"))
    return undefined;
  const url = new URL(localized, siteOrigin);
  // Browsers read "/\host" as a link to another site.
  if (url.origin !== siteOrigin) return undefined;
  let hash: string | undefined;
  try {
    // The router encodes the fragment itself.
    hash = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined;
  } catch {
    return undefined;
  }
  let search: Record<string, unknown> | undefined;
  if (url.search) {
    search = options.parseSearch(url.search);
    // The router stores search as JSON values. Repeated keys and other values
    // it cannot write back unchanged stay with the browser.
    if (options.stringifySearch(search) !== url.search) return undefined;
  }
  return {
    to: url.pathname,
    ...(search === undefined ? {} : { search }),
    ...(hash === undefined ? {} : { hash }),
  };
}
