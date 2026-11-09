import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinEditor } from "@/components/editor/skin-editor";
import { editorSearch } from "@/lib/editor-search";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { useLocale, useT } from "@/lib/i18n-react";

function EditorPage() {
  const t = useT();
  const locale = useLocale();
  const { texture } = Route.useSearch();
  return (
    <main className="px-4 py-10 w-full max-w-[1400px] mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-3 max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("Skin editor")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("Edit a Minecraft Java Edition skin in your browser.")}{" "}
          <Link
            to="/{-$lang}/docs/$"
            params={{
              lang: locale === "en" ? undefined : locale,
              _splat: "features/skin-editor",
            }}
            className="text-foreground underline underline-offset-4"
          >
            {t("Read the editor guide")}
          </Link>
        </p>
      </div>
      <SkinEditor texture={texture} />
    </main>
  );
}

export const Route = createFileRoute("/{-$lang}/editor")({
  validateSearch: editorSearch,
  head: ({ params }) =>
    getPageHead("/editor", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "Skin Editor",
      description:
        "Edit a Minecraft skin in your browser: paint in 2D or 3D, fix Java Edition skin problems, and get a SkinsRestorer command.",
    }),
  component: () => (
    <HomeLayout>
      <EditorPage />
    </HomeLayout>
  ),
});
