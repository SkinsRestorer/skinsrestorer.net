import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { SkinEditor } from "@/components/editor/skin-editor";
import { editorSearch } from "@/lib/editor-search";
import { getPageHead } from "@/lib/seo";

function EditorPage() {
  const { texture } = Route.useSearch();
  return (
    <main className="px-4 py-10 w-full max-w-[1400px] mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-3 max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Skin editor
        </h1>
        <p className="text-lg text-muted-foreground">
          Fix and touch up a Minecraft Java Edition skin, then download it or
          get a SkinsRestorer command for it.
        </p>
        <p className="text-sm text-muted-foreground">
          Editing, drafts, and PNG downloads happen in your browser. The editor
          does not send your skin image to SkinsRestorer or to any other server.
          If you open a texture URL, your browser downloads that image from
          textures.minecraft.net. If you choose Use in Upload or Use in
          Generator, that page sends the PNG to MineSkin, directly or through
          the SkinsRestorer Axolotl proxy, only when you press its button.
        </p>
      </div>
      <SkinEditor texture={texture} />
    </main>
  );
}

export const Route = createFileRoute("/editor")({
  validateSearch: editorSearch,
  head: () =>
    getPageHead("/editor", {
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
