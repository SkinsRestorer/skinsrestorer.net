import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinStudio } from "@/components/studio/skin-studio";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { studioSearch } from "@/lib/studio";

export const Route = createFileRoute("/{-$lang}/studio")({
  validateSearch: studioSearch,
  head: ({ params }) =>
    getPageHead("/studio", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "Skin Studio",
      description:
        "Edit Minecraft skins in your browser, keep them in a local library, and get /skin url or /sr createcustom commands.",
    }),
  component: function Page() {
    return (
      <HomeLayout>
        <SkinStudio entry="studio" search={Route.useSearch()} />
      </HomeLayout>
    );
  },
});
