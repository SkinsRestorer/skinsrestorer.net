import { createFileRoute } from "@tanstack/react-router";
import IndexPage from "@/components/home/home-page";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";

export const Route = createFileRoute("/{-$lang}/")({
  head: ({ params }) => {
    const head = getPageHead("/", {
      locale: isLocale(params.lang) ? params.lang : "en",
    });
    return {
      ...head,
      links: [
        ...head.links,
        // The hero heading uses this font. Loading it early keeps the swap from moving the hero.
        {
          rel: "preload",
          href: "/fonts/geist-pixel-square.woff2",
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
