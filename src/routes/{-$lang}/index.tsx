import { createFileRoute } from "@tanstack/react-router";
import {
  pixelHeadingFontHref,
  usesPixelHeadingFont,
} from "@/components/home/heading-font";
import IndexPage from "@/components/home/home-page";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";

export const Route = createFileRoute("/{-$lang}/")({
  head: ({ params }) => {
    const locale = isLocale(params.lang) ? params.lang : "en";
    const head = getPageHead("/", { locale });
    if (!usesPixelHeadingFont(locale)) return head;
    return {
      ...head,
      links: [
        ...head.links,
        // The hero heading uses this font. Loading it early keeps the swap from moving the hero.
        {
          rel: "preload",
          href: pixelHeadingFontHref,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
      ],
    };
  },
  component: () => (
    <HomeLayout>
      <IndexPage />
    </HomeLayout>
  ),
});
