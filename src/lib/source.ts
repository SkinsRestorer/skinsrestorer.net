import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { icons } from "lucide-react";
import { createElement } from "react";
import { i18n } from "@/lib/i18n";

export const source = loader({
  i18n,
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});

export function getPageImage(page: InferPageType<typeof source>) {
  const locale = page.locale ?? i18n.defaultLanguage;
  const segments =
    locale === i18n.defaultLanguage
      ? [...page.slugs, "image.png"]
      : [locale, ...page.slugs, "image.png"];

  return {
    segments,
    url: `/docs-og/${segments.join("/")}`,
  };
}
