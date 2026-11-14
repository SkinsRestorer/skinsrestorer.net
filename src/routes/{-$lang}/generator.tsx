import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinStudio } from "@/components/studio/skin-studio";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { studioSearch, type StudioSearch } from "@/lib/studio";

const noSearch: StudioSearch = {};

export const Route = createFileRoute("/{-$lang}/generator")({
  validateSearch: studioSearch,
  head: ({ params }) =>
    getPageHead("/generator", {
      locale: isLocale(params.lang) ? params.lang : "en",
      titleKey: "generator.title",
      descriptionKey: "generator.description",
    }),
  component: function Page() {
    const search = Route.useSearch();
    // Prerendered HTML has no query: apply it after hydration.
    const hydrated = useHydrated();
    return (
      <HomeLayout>
        <SkinStudio entry="generator" search={hydrated ? search : noSearch} />
      </HomeLayout>
    );
  },
});
