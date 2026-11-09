import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinStudio } from "@/components/studio/skin-studio";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { studioSearch } from "@/lib/studio";

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
    return (
      <HomeLayout>
        <SkinStudio entry="upload" search={Route.useSearch()} />
      </HomeLayout>
    );
  },
});
