import { localizeHref, type Locale } from "./i18n";

export const siteOrigin = "https://skinsrestorer.net";

/** Resolve a site path to an absolute URL in the reader's language. */
export function absoluteDocsUrl(href: string, locale: Locale = "en") {
  return new URL(localizeHref(href, locale), siteOrigin).href;
}

/**
 * Exported Markdown leaves the site, so root-relative links must become
 * absolute. Fumadocs heading IDs (`## Title [#id]`) are not standard Markdown
 * and only add noise. Code blocks stay unchanged.
 */
export function formatExportedMarkdown(markdown: string, locale: Locale) {
  let fence: string | undefined;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
      if (marker) {
        if (!fence) fence = marker;
        else if (marker[0] === fence[0] && marker.length >= fence.length)
          fence = undefined;
        return line;
      }
      if (fence) return line;
      return line
        .replace(/^(#{1,6}\s.*?)\s+\[#[^\]\s]+\]\s*$/, "$1")
        .replaceAll(
          /\]\((\/(?!\/)[^)\s]*)\)/g,
          (_, href: string) => `](${absoluteDocsUrl(href, locale)})`,
        );
    })
    .join("\n");
}
