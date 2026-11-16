import type { Locale } from "@/lib/i18n";

export const pixelHeadingFontHref = "/fonts/geist-pixel-square.woff2";

// Geist Pixel Square only has Latin glyphs. Cyrillic text would fall back to
// monospace in the middle of a heading, so those locales use the body font.
const pixelHeadingLocales: ReadonlySet<Locale> = new Set(["en", "es", "pt-BR"]);

export function usesPixelHeadingFont(locale: Locale) {
  return pixelHeadingLocales.has(locale);
}

export function headingFontClassName(locale: Locale) {
  return usesPixelHeadingFont(locale)
    ? "font-(family-name:--font-geist-pixel-square)"
    : "font-semibold";
}
