import { createFileRoute } from "@tanstack/react-router";
import IndexPage from "@/components/home/home-page";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";

export const Route = createFileRoute("/{-$lang}/")({
  head: ({ params }) =>
    getPageHead("/", { locale: isLocale(params.lang) ? params.lang : "en" }),
  component: () => (
    <HomeLayout>
      <IndexPage />
    </HomeLayout>
  ),
});
