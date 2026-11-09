import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { editorHandoffSearch } from "@/lib/editor-search";
import {
  GenerateFileCard,
  ReverseFileCard,
} from "@/components/generator/generator-card";
import { useT } from "@/lib/i18n-react";

function GeneratorPage() {
  const t = useT();
  const { handoff: handoffId } = Route.useSearch();
  return (
    <main className="px-4 py-12 w-full max-w-[1400px] mx-auto flex flex-col gap-10">
      <div className="flex flex-col gap-4 text-center max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("Custom Skin Generator")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("Upload a PNG skin to get an in-game")}{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
            /sr createcustom
          </code>{" "}
          {t("command or reverse existing custom skin files")}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-6 max-w-5xl mx-auto items-start">
        <GenerateFileCard handoffId={handoffId} />
        <ReverseFileCard />
      </div>
    </main>
  );
}

export const Route = createFileRoute("/{-$lang}/generator")({
  validateSearch: editorHandoffSearch,
  head: ({ params }) =>
    getPageHead("/generator", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "Custom Skin Generator",
      description:
        "Generate copyable /sr createcustom commands or reverse existing skin files.",
    }),
  component: () => (
    <HomeLayout>
      <GeneratorPage />
    </HomeLayout>
  ),
});
