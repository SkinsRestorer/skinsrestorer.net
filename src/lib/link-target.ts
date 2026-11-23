import type { AnyRouter } from "@tanstack/react-router";
import { localizeHref, type Locale } from "./i18n";

function decodeFragment(hash: string) {
  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

/**
 * Router `to` values are paths, so a query or fragment inside one becomes part
 * of the path. Return them as separate options. Links that do not start with
 * a site path return `undefined`, and the caller passes them through.
 */
export function getLinkTarget(
  href: string,
  locale: Locale,
  parseSearch: AnyRouter["options"]["parseSearch"],
): { to: string; search?: Record<string, unknown>; hash?: string } | undefined {
  const localized = localizeHref(href, locale);
  if (!localized.startsWith("/") || localized.startsWith("//"))
    return undefined;
  const url = new URL(localized, "https://skinsrestorer.net");
  return {
    to: url.pathname,
    ...(url.search ? { search: parseSearch(url.search) } : {}),
    // The router encodes the fragment itself.
    ...(url.hash ? { hash: decodeFragment(url.hash.slice(1)) } : {}),
  };
}
