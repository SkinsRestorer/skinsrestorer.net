import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinStudio } from "@/components/studio/skin-studio";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { studioSearch, type StudioSearch } from "@/lib/studio";

const noSearch: StudioSearch = {};

export const Route = createFileRoute("/{-$lang}/upload")({
  validateSearch: studioSearch,
  head: ({ params }) =>
    getPageHead("/upload", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "Skin Upload",
      description:
        "Upload a skin PNG and get a copyable /skin url command using MineSkin.",
    }),
  component: function Page() {
    const search = Route.useSearch();
    // Prerendered HTML has no query: apply it after hydration.
    const hydrated = useHydrated();
    return (
      <HomeLayout>
        <SkinStudio entry="upload" search={hydrated ? search : noSearch} />
      </HomeLayout>
    );
  },
});
