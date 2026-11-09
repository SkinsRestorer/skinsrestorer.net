import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinStudio } from "@/components/studio/skin-studio";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { studioSearch } from "@/lib/studio";

export const Route = createFileRoute("/{-$lang}/generator")({
  validateSearch: studioSearch,
  head: ({ params }) =>
    getPageHead("/generator", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "Custom Skin Generator",
      description:
        "Generate copyable /sr createcustom commands or reverse existing skin files.",
    }),
  component: function Page() {
    return (
      <HomeLayout>
        <SkinStudio entry="generator" search={Route.useSearch()} />
      </HomeLayout>
    );
  },
});
