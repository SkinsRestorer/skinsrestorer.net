"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Link } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  Check,
  Copy,
  Download,
  FolderPlus,
  Images,
  Link2,
  LoaderCircle,
  PanelLeft,
  Pencil,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import posthog from "posthog-js";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AdvancedOptions,
  type UploadMethod,
} from "@/components/advanced-options";
import {
  CapePicker,
  MineSkinKeyFields,
} from "@/components/cape-support-fields";
import { ModelSelector } from "@/components/model-selector";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalizedDialogContent } from "@/components/localized-dialog";
import { runHttpEffect } from "@/lib/effect-http";
import {
  documentOf,
  EditorSession,
  type SaveResult,
} from "@/lib/editor-session";
import {
  NO_CAPE_VALUE,
  useCapeSelection,
} from "@/lib/hooks/use-cape-selection";
import { useEditorHandoff } from "@/lib/hooks/use-editor-handoff";
import { useLatestTask } from "@/lib/hooks/use-latest-task";
import { useSkinLibrary } from "@/lib/hooks/use-skin-library";
import { useSkinGallery } from "@/lib/hooks/use-skin-gallery";
import { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import { useStudioGeneration } from "@/lib/hooks/use-studio-generation";
import { isValidSkinName } from "@/lib/skin";
import { createTemplate, MAX_SKIN_FILE_BYTES } from "@/lib/skin-document";
import { browserStorage, discardDraft } from "@/lib/skin-draft";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import { browserLibrary, withLibrary } from "@/lib/skin-library-client";
import { prepareSkinContent, type StoredSkin } from "@/lib/skin-library";
import {
  selectionEditable,
  type GenerationInput,
  type SelectedSkin,
} from "@/lib/skin-selection";
import { loadTextureEffect } from "@/lib/skin-texture";
import { galleryPermalink, type GallerySkin } from "@/lib/skin-gallery";
import { downloadSkin } from "@/lib/hooks/use-skin-library";
import {
  fixedPurpose,
  readSkinFileTexture,
  suggestSkinName,
  type StudioEntry,
  type StudioPurpose,
  type StudioSearch,
} from "@/lib/studio";
import type { GenerationResult } from "@/lib/studio-generation";
import { useLocale, useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";
import { SkinThumbnail } from "./skin-thumbnail";
import { SkinView } from "./skin-view";
import { StudioGallery } from "./studio-gallery";
import { DraftRecovery, StudioEditor } from "./studio-editor";
import {
  AddSkinMenu,
  StudioLibrary,
  type LibraryCommands,
} from "./studio-library";

const intro: Record<
  StudioEntry,
  { title: string; description: string; guide: string }
> = {
  studio: {
    title: "Skin Studio",
    description:
      "Keep skins in this browser, edit them in 2D or 3D, and get a SkinsRestorer command.",
    guide: "features/skin-editor",
  },
  upload: {
    title: "Skin Upload",
    description: "Upload a PNG skin and get a copyable /skin url",
    guide: "features/skin-upload",
  },
  generator: {
    title: "Custom Skin Generator",
    description:
      "Generate copyable /sr createcustom commands or reverse existing skin files.",
    guide: "features/custom-skins",
  },
};

const panel =
  "min-w-0 rounded-xl border bg-card p-3 text-card-foreground sm:p-4";

function errorMessage(cause: unknown) {
  return cause && typeof cause === "object" && "message" in cause
    ? String(cause.message)
    : "Something went wrong.";
}

/** One pixel store and library session for the whole Studio visit. */
function useEditorSession() {
  const [editor] = useState(() => {
    const store = new SkinEditorStore();
    // The server renders without a library; the browser opens it.
    const session = new EditorSession(store, browserLibrary());
    session.start(createTemplate("classic"), { name: "New skin" });
    return { store, session };
  });
  useEffect(() => () => editor.session.dispose(), [editor]);
  return editor;
}

type Mode =
  | { readonly kind: "view" }
  | { readonly kind: "edit"; readonly isNew: boolean };

/**
 * The Studio: the library on the left, the selected skin in 3D in the
 * center, and the options for its command on the right. Upload and
 * Generator render it with a fixed purpose. Gallery and texture imports read
 * public images; the selected skin uploads only through the generate button.
 */
export function SkinStudio(props: {
  entry: StudioEntry;
  search: StudioSearch;
}) {
  const t = useT();
  const locale = useLocale();
  const selection = useSkinSelection();
  const { store, state } = selection;
  const library = useSkinLibrary();
  const editor = useEditorSession();
  const generation = useStudioGeneration();
  const importTask = useLatestTask();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [drawer, setDrawer] = useState(false);
  const [textureDialog, setTextureDialog] = useState(false);
  const [dragging, setDragging] = useState(false);
  const initialGallery = useRef(
    props.search.texture || props.search.handoff
      ? undefined
      : props.search.skin,
  );
  const [linkPending, setLinkPending] = useState(false);
  const [source, setSource] = useState<"library" | "gallery">("library");
  const [galleryQuery, setGalleryQuery] = useState("");
  const [pendingGallery, setPendingGallery] = useState<string>();
  const [galleryError, setGalleryError] = useState<string>();
  const gallery = useSkinGallery(source === "gallery" || linkPending);
  const pngInput = useRef<HTMLInputElement>(null);
  const skinFileInput = useRef<HTMLInputElement>(null);

  // Prerendered HTML has no query. Apply query choices after hydration so a
  // shared URL starts with the same markup as the server's static page.
  const [intent, setIntent] = useState<StudioPurpose>();
  useEffect(() => setIntent(props.search.intent), [props.search.intent]);
  useEffect(() => {
    if (!initialGallery.current) return;
    setSource("gallery");
    setLinkPending(true);
  }, []);
  const fixed = fixedPurpose(props.entry, intent);
  const [chosen, setChosen] = useState<StudioPurpose>("skin-url");
  const purpose = fixed ?? chosen;
  const [method, setMethod] = useState<UploadMethod>("axolotl");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const capes = useCapeSelection({ autoGrantCapeAccess: method === "axolotl" });

  const cancelImport = () => {
    initialGallery.current = undefined;
    setLinkPending(false);
    setPendingGallery(undefined);
    setGalleryError(undefined);
    importTask.cancel();
  };

  useEditorHandoff(props.search.handoff, (file, variant) => {
    cancelImport();
    store.select(file, { origin: "handoff", variant });
  });

  // Offer drafts from earlier visits or other tabs.
  useEffect(() => {
    void editor.session.loadRecovery();
  }, [editor.session]);

  /** Download a trusted texture, keep it in the library, and select it. */
  const importTexture = (reference: string) => {
    cancelImport();
    void importTask.run(
      async (signal) => {
        const result = await runHttpEffect(
          loadTextureEffect(reference),
          signal,
        );
        const png = new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
          type: "image/png",
        });
        const name = `Texture ${result.hash.slice(0, 8)}`;
        const client = library.client;
        if (!client) return { png, name, skin: undefined };
        try {
          const { skin } = await client.run(
            Effect.gen(function* () {
              const content = yield* prepareSkinContent(png);
              return yield* withLibrary((l) =>
                l.add(
                  {
                    name,
                    content,
                    source: { kind: "texture", textureHash: result.hash },
                  },
                  { dedupe: true },
                ),
              );
            }),
            signal,
          );
          return { png, name, skin };
        } catch {
          return { png, name, skin: undefined };
        }
      },
      ({ png, name, skin }) => {
        setMode({ kind: "view" });
        if (skin) store.selectSkin(skin);
        else
          store.select(new File([png], `${name}.png`, { type: "image/png" }), {
            origin: "file",
            name,
          });
        posthog.capture("editor_opened", { source: "texture_url" });
      },
      (cause) => toast.error(t(errorMessage(cause))),
    );
  };

  const textureRef = useRef(props.search.texture);
  useEffect(() => {
    if (textureRef.current) importTexture(textureRef.current);
    textureRef.current = undefined;
    // Only the texture from the URL that opened the page.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSkinFile = async (file: File) => {
    try {
      const { url, legacy } = readSkinFileTexture(await file.text());
      if (legacy)
        toast.warning(t("Falling back to legacy skin format."), {
          description: t("Please update SkinsRestorer as soon as possible."),
        });
      importTexture(url);
    } catch (cause) {
      toast.error(
        t("Failed to reverse skin file: {error}", {
          error: t(errorMessage(cause)),
        }),
      );
    }
  };

  const commands: LibraryCommands = {
    upload: () => pngInput.current?.click(),
    create: () => {
      // A newer choice owns the workspace: drop pending imports and decodes.
      cancelImport();
      editor.session.start(createTemplate(state.variant), {
        name: t("New skin"),
      });
      setDrawer(false);
      setMode({ kind: "edit", isNew: true });
      posthog.capture("editor_opened", { source: "template" });
    },
    openSkinFile: () => skinFileInput.current?.click(),
    openTexture: () => setTextureDialog(true),
  };

  const choose = (skin: StoredSkin) => {
    cancelImport();
    store.selectSkin(skin);
    setDrawer(false);
    posthog.capture("skin_library_action", { action: "select" });
  };

  const selectFiles = (files: readonly File[]) => {
    const pngs = files.filter(
      (file) => file.type === "image/png" || /\.png$/i.test(file.name),
    );
    const rejected = files.length - pngs.length;
    const fitting = pngs.filter((file) => file.size <= MAX_SKIN_FILE_BYTES);
    if (rejected || fitting.length < pngs.length)
      toast.error(t("Choose PNG files up to 5 MB."));
    if (fitting.length) {
      cancelImport();
      setDrawer(false);
      store.selectFiles(fitting.slice(0, 20));
    }
  };

  const current = state.selection;
  const openGallery = () => {
    setSource("gallery");
    if (window.matchMedia("(max-width: 639px)").matches) setDrawer(true);
  };
  const chooseGallery = (skin: GallerySkin) => {
    cancelImport();
    setPendingGallery(skin.id);
    void importTask.run(
      (signal) => runHttpEffect(loadTextureEffect(skin.textureUrl), signal),
      (result) => {
        setPendingGallery(undefined);
        setMode({ kind: "view" });
        setDrawer(false);
        store.select(
          new File(
            [result.bytes as Uint8Array<ArrayBuffer>],
            `${skin.id}.png`,
            { type: "image/png" },
          ),
          {
            origin: "gallery",
            galleryId: skin.id,
            name: skin.name,
            variant: skin.variant,
          },
        );
      },
      () => {
        setPendingGallery(undefined);
        setGalleryError("This gallery skin could not be opened. Try again.");
      },
    );
  };

  useEffect(() => {
    const id = initialGallery.current;
    if (!id || gallery.state.status !== "ready") return;
    initialGallery.current = undefined;
    setLinkPending(false);
    const skin = gallery.state.skins.find((skin) => skin.id === id);
    if (skin) chooseGallery(skin);
    else setGalleryError("This skin is no longer in the gallery.");
    // Only apply the catalog link that opened the page; newer choices own selection.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery.state]);

  const keepGallery = () => {
    if (!current || current.origin !== "gallery" || current.status !== "ready")
      return;
    const client = library.client;
    if (!client) return;
    const token = current.token;
    const variant = state.variant;
    cancelImport();
    void importTask.run(
      (signal) =>
        client.run(
          Effect.gen(function* () {
            const content = yield* prepareSkinContent(current.file, variant);
            return yield* withLibrary((l) =>
              l.add(
                { name: current.name, content, source: { kind: "file" } },
                { dedupe: true },
              ),
            );
          }),
          signal,
        ),
      ({ skin }) => {
        const latest = store.getSnapshot();
        if (latest.selection?.token !== token || latest.variant !== variant)
          return;
        store.selectSkin(skin);
      },
      (cause) => toast.error(t(errorMessage(cause))),
    );
  };
  const editSelected = () => {
    if (!current || current.status !== "ready") return;
    const { token } = current;
    cancelImport();
    void importTask.run(
      () => documentOf(current.file, state.variant),
      (document) => {
        // Another skin was selected while this one was decoding.
        if (store.getSnapshot().selection?.token !== token) return;
        editor.session.start(document, {
          skinId: current.skinId,
          baseRevision: current.revision,
          name: current.name,
        });
        setMode({ kind: "edit", isNew: current.origin === "gallery" });
        posthog.capture("skin_edit_opened", { page: props.entry });
      },
      (cause) => toast.error(t(errorMessage(cause))),
    );
  };

  const exitEdit = () => {
    setMode({ kind: "view" });
    // A new session id, so kept drafts show as recoverable work.
    editor.session.start(createTemplate("classic"), { name: t("New skin") });
    void editor.session.loadRecovery();
  };

  const saved = (result: Extract<SaveResult, { kind: "saved" }>) => {
    setSource("library");
    if (result.skin) store.selectSkin(result.skin, "editor");
    else
      store.select(result.file, {
        origin: "editor",
        variant: result.variant,
        name: result.name,
      });
    exitEdit();
  };

  // Generation: the input is everything the result depends on.
  const name = purpose === "createcustom" ? customName.trim() : "";
  const nameInvalid = name !== "" && !isValidSkinName(name);
  const input: GenerationInput | null = selection.file
    ? {
        purpose,
        file: selection.file,
        variant: state.variant,
        method,
        capeUuid: capes.selectedCapeUuid,
        name,
      }
    : null;
  const shown = generation.for(input);
  // Any change to the inputs stops waiting for a pending upload.
  useEffect(
    () => () => generation.cancel(),
    [
      generation,
      purpose,
      selection.file,
      state.variant,
      method,
      capes.selectedCapeUuid,
      capes.normalizedApiKey,
      name,
    ],
  );

  const generate = () => {
    if (!input || nameInvalid || pendingGallery) return;
    const fromEditor =
      current?.origin === "handoff" || current?.origin === "editor";
    const cape =
      capes.selectedCapeUuid === NO_CAPE_VALUE
        ? undefined
        : capes.selectedCapeUuid;
    void generation
      .generate(input, {
        file: input.file,
        variant: input.variant,
        name: input.name || undefined,
        capeUuid: cape,
        apiKey: capes.normalizedApiKey || undefined,
        useCapeProxy: method === "axolotl" && cape !== undefined,
      })
      .then(() => {
        if (fromEditor && generation.for(input).status === "done")
          posthog.capture("editor_handoff_completed", {
            target: purpose === "createcustom" ? "generator" : "upload",
          });
      });
  };

  const editing = mode.kind === "edit";
  const info = intro[props.entry];
  const libraryView = (layout: "rail" | "drawer", close?: React.ReactNode) => (
    <Tabs
      className="group/tabs"
      orientation={layout === "rail" ? "vertical" : "horizontal"}
      value={source}
      onValueChange={(value) => setSource(value as "library" | "gallery")}
    >
      {close && <div className="flex justify-end">{close}</div>}
      <TabsList className="w-full" aria-label={t("Skin sources")}>
        <TabsTrigger
          className="h-auto w-full min-w-0 whitespace-normal"
          value="library"
        >
          {t("Library")}
        </TabsTrigger>
        <TabsTrigger
          className="h-auto w-full min-w-0 whitespace-normal"
          value="gallery"
        >
          {t("Gallery")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="library">
        <StudioLibrary
          library={library}
          selectedId={current?.skinId}
          commands={commands}
          onSelect={choose}
          onReverted={(skin) => {
            if (skin.id === current?.skinId) store.selectSkin(skin);
          }}
          layout={layout}
          hideHeading
        />
      </TabsContent>
      <TabsContent value="gallery">
        <StudioGallery
          state={gallery.state}
          query={galleryQuery}
          onQuery={setGalleryQuery}
          onRetry={gallery.retry}
          onSelect={chooseGallery}
          selectedId={current?.galleryId}
          pendingId={pendingGallery}
          layout={layout}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 pt-4 pb-10 sm:pt-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">
          {t(info.title)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(info.description)}{" "}
          <Link
            to="/{-$lang}/docs/$"
            params={{
              lang: locale === "en" ? undefined : locale,
              _splat: info.guide,
            }}
            className="text-foreground underline underline-offset-4"
          >
            {t("Read the guide")}
          </Link>
        </p>
      </header>

      <div className="grid items-start gap-2 sm:grid-cols-[108px_minmax(0,1fr)_236px] md:grid-cols-[132px_minmax(0,1fr)_272px] lg:grid-cols-[184px_minmax(0,1fr)_320px] xl:gap-3">
        <div className="flex items-center gap-2 sm:hidden">
          <Button
            variant="outline"
            disabled={editing}
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <PanelLeft data-icon="inline-start" />
            {t(source === "gallery" ? "Gallery" : "Library")}
          </Button>
          <span className="ml-auto">
            <AddSkinMenu commands={commands} disabled={editing} />
          </span>
        </div>

        <aside
          aria-label={t("Skin sources")}
          inert={editing || undefined}
          className={cn(
            panel,
            "hidden p-2.5 sm:sticky sm:top-20 sm:block sm:max-h-[calc(100dvh-6rem)] sm:overflow-y-auto sm:p-2.5",
            editing && "opacity-45",
          )}
        >
          {libraryView("rail")}
        </aside>

        {editing ? (
          <StudioEditor
            store={editor.store}
            session={editor.session}
            isNew={mode.isNew}
            onSaved={saved}
            onExit={exitEdit}
          />
        ) : (
          <>
            <section
              aria-label={t("Skin")}
              className={cn(
                panel,
                "flex flex-col gap-3",
                dragging && "ring-2 ring-foreground/40",
              )}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node))
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFiles([...event.dataTransfer.files]);
              }}
            >
              <LegacyDraftAlerts migrated={library.migrated?.status} />
              {(galleryError ||
                (linkPending && gallery.state.status === "error")) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(
                      galleryError ??
                        "The gallery could not be loaded. Try again.",
                    )}
                  </AlertDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (gallery.state.status === "error") gallery.retry();
                      else {
                        openGallery();
                        setGalleryError(undefined);
                      }
                    }}
                  >
                    {t(
                      gallery.state.status === "error"
                        ? "Try again"
                        : "Browse gallery",
                    )}
                  </Button>
                </Alert>
              )}
              <DraftRecovery
                session={editor.session}
                onContinue={() =>
                  setMode({
                    kind: "edit",
                    isNew: !editor.session.getSnapshot().target.skinId,
                  })
                }
              />
              {current ? (
                <SelectedSkinView
                  selection={current}
                  variant={state.variant}
                  previewUrl={state.previewUrl}
                  capeUrl={capes.selectedCape?.url}
                  onEdit={editSelected}
                  onUseLatest={() => store.useLatest()}
                  onKeep={
                    current.origin === "gallery" ? keepGallery : undefined
                  }
                  galleryLink={
                    current.galleryId
                      ? galleryPermalink(current.galleryId, locale, fixed)
                      : undefined
                  }
                />
              ) : (
                <div className="grid h-[300px] place-items-center rounded-lg border border-dashed text-center sm:h-[360px]">
                  <div className="flex flex-col items-center gap-3 px-4">
                    <h2 className="text-base font-semibold">
                      {t("No skin selected")}
                    </h2>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={commands.upload}>
                        <Upload data-icon="inline-start" />
                        {t("Upload skin")}
                      </Button>
                      <Button variant="outline" onClick={commands.create}>
                        <Pencil data-icon="inline-start" />
                        {t("Create skin")}
                      </Button>
                      <Button variant="outline" onClick={openGallery}>
                        <Images data-icon="inline-start" />
                        {t("Browse gallery")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section
              aria-label={t("Options")}
              className={cn(panel, "flex flex-col gap-4")}
            >
              {fixed ? (
                <h2 className="text-base font-semibold">
                  {fixed === "createcustom"
                    ? t("Create a custom skin")
                    : t("Use on a server")}
                </h2>
              ) : (
                <ToggleGroup
                  aria-label={t("Purpose")}
                  variant="outline"
                  spacing={0}
                  className="grid w-full grid-cols-2"
                  value={[purpose]}
                  onValueChange={(value) => {
                    if (value[0]) setChosen(value[0] as StudioPurpose);
                  }}
                >
                  <ToggleGroupItem value="skin-url" className="w-full">
                    {t("Use on a server")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="createcustom" className="w-full">
                    {t("Custom skin")}
                  </ToggleGroupItem>
                </ToggleGroup>
              )}

              {purpose === "createcustom" && (
                <SkinNameField
                  value={customName}
                  placeholder={
                    (current && suggestSkinName(current.name)) ||
                    "cool_skin_name"
                  }
                  invalid={nameInvalid}
                  onChange={setCustomName}
                />
              )}

              <OptionGroup label={t("Model")}>
                {(labelId) => (
                  <ModelSelector
                    aria-labelledby={labelId}
                    layout="stacked"
                    value={state.variant}
                    onValueChange={(value) => store.setVariant(value)}
                  />
                )}
              </OptionGroup>

              <OptionGroup label={t("Cape")}>
                {(labelId) => (
                  <CapePicker
                    labelledBy={labelId}
                    capeOptionsDisabled={capes.capeOptionsDisabled}
                    supportedCapes={capes.supportedCapes}
                    selectedCapeUuid={capes.selectedCapeUuid}
                    onCapeChange={capes.handleCapeSelect}
                    keyHint={
                      method === "mineskin" &&
                      capes.capeStatus !== "granted" && (
                        <p className="text-xs text-muted-foreground">
                          {t(
                            "Load cape support with a valid API key under Advanced options to preview and apply capes.",
                          )}{" "}
                          {!advancedOpen && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setAdvancedOpen(true)}
                            >
                              {t("Open advanced options")}
                            </Button>
                          )}
                        </p>
                      )
                    }
                  />
                )}
              </OptionGroup>

              <AdvancedOptions
                method={method}
                onMethodChange={setMethod}
                open={advancedOpen}
                onOpenChange={setAdvancedOpen}
                officialFields={
                  <MineSkinKeyFields
                    apiKey={capes.apiKey}
                    capeStatus={capes.capeStatus}
                    onApiKeyChange={capes.handleApiKeyChange}
                    onCheckCapeAccess={capes.loadCapeSupport}
                  />
                }
              />

              <Button
                className="w-full"
                disabled={
                  !input ||
                  !!pendingGallery ||
                  nameInvalid ||
                  shown.status === "pending"
                }
                title={current ? undefined : t("Select a skin first")}
                onClick={generate}
              >
                {shown.status === "pending" && (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                {shown.status === "pending"
                  ? t("Generating…")
                  : purpose === "createcustom"
                    ? t("Generate /sr createcustom")
                    : t("Generate /skin url")}
              </Button>

              {shown.status === "failed" && (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>
                    {t("Failed to upload skin: {error}", {
                      error: t(shown.message),
                    })}
                  </AlertDescription>
                </Alert>
              )}
              {shown.status === "done" && <Result result={shown.result} />}
            </section>
          </>
        )}
      </div>

      <input
        ref={pngInput}
        type="file"
        accept=".png,image/png"
        multiple
        hidden
        aria-label={t("Select skin PNG files")}
        onChange={(event) => {
          selectFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <input
        ref={skinFileInput}
        type="file"
        accept=".playerskin,.urlskin,.customskin,.legacyskin,.skin"
        hidden
        aria-label={t("Select skin file to reverse")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && file.size <= MAX_SKIN_FILE_BYTES) void openSkinFile(file);
          else if (file) toast.error(t("Choose a file up to 5 MB."));
        }}
      />

      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogPortal>
          <DialogOverlay className="sm:hidden" />
          <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 w-[min(16rem,82vw)] overflow-y-auto border-r bg-card p-3 text-card-foreground outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left sm:hidden">
            <DialogPrimitive.Title className="sr-only">
              {t("Skin sources")}
            </DialogPrimitive.Title>
            {libraryView(
              "drawer",
              <DialogPrimitive.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("Close skin browser")}
                  />
                }
              >
                <X />
              </DialogPrimitive.Close>,
            )}
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>

      <TextureDialog
        open={textureDialog}
        onOpenChange={setTextureDialog}
        onOpen={(reference) => {
          setTextureDialog(false);
          importTexture(reference);
        }}
      />
    </main>
  );
}

function OptionGroup(props: {
  label: string;
  children: (labelId: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium">
        {props.label}
      </span>
      {props.children(id)}
    </div>
  );
}

function SkinNameField(props: {
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <Field data-invalid={props.invalid || undefined}>
      <FieldLabel htmlFor={id}>{t("Skin name (optional)")}</FieldLabel>
      <Input
        id={id}
        value={props.value}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={props.invalid || undefined}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.invalid && (
        <FieldError>
          {t("Use lowercase letters, numbers, and underscores.")}
        </FieldError>
      )}
    </Field>
  );
}

function SelectedSkinView(props: {
  selection: SelectedSkin;
  variant: "classic" | "slim";
  previewUrl: string | null;
  capeUrl?: string;
  onEdit: () => void;
  onUseLatest: () => void;
  onKeep?: () => void;
  galleryLink?: string;
}) {
  const t = useT();
  const { selection } = props;
  const editable = selectionEditable(selection);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <>
      <div className="ph-no-capture flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="min-w-0 truncate text-base font-semibold">
          {selection.name}
        </h2>
        {selection.status !== "invalid" &&
          selection.keep.kind !== "catalog" && (
            <KeepStatus selection={selection} />
          )}
        {selection.keep.kind === "changed" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("Changed in another tab.")}
            <Button variant="link" size="sm" onClick={props.onUseLatest}>
              {t("Use the new version")}
            </Button>
          </span>
        )}
      </div>
      {selection.status === "invalid" ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("This file cannot be used")}</AlertTitle>
          <AlertDescription>{t(selection.error ?? "")}</AlertDescription>
        </Alert>
      ) : (
        <SkinView
          skinUrl={props.previewUrl}
          capeUrl={props.capeUrl}
          variant={props.variant}
          label={t("{name}, 3D view. Drag or use the arrow keys to turn it.", {
            name: selection.name,
          })}
          fallback={
            selection.status === "ready" && (
              <SkinThumbnail
                png={selection.file}
                variant={props.variant}
                className="h-40 w-20"
              />
            )
          }
        />
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          disabled={!editable}
          title={
            selection.status === "ready" && !editable
              ? t("Only 64×64 and 64×32 skins")
              : undefined
          }
          onClick={props.onEdit}
        >
          <Pencil data-icon="inline-start" />
          {t("Edit skin")}
        </Button>
        {props.onKeep && (
          <Button
            size="icon"
            variant="ghost"
            disabled={selection.status !== "ready"}
            aria-label={t("Save to library")}
            title={t("Save to library")}
            onClick={props.onKeep}
          >
            <FolderPlus />
          </Button>
        )}
        {props.galleryLink && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("Copy gallery link")}
              title={t("Copy gallery link")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    new URL(props.galleryLink!, window.location.origin).href,
                  )
                  .then(
                    () => setCopied(true),
                    () => toast.error(t("Failed to copy")),
                  )
              }
            >
              {copied ? <Check /> : <Link2 />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={selection.status !== "ready"}
              aria-label={t("Download PNG")}
              title={t("Download PNG")}
              onClick={() => downloadSkin(selection.file, selection.name)}
            >
              <Download />
            </Button>
          </>
        )}
      </div>
    </>
  );
}

/** Whether the selected skin is kept in this browser, as a quiet icon. */
function KeepStatus(props: { selection: SelectedSkin }) {
  const t = useT();
  const keep = props.selection.keep;
  const [state, label]: [SaveState, string] =
    keep.kind === "saving"
      ? ["saving", t("Saving to the library")]
      : keep.kind === "off"
        ? ["unavailable", t("Not saved. {error}", { error: t(keep.message) })]
        : keep.kind === "removed"
          ? ["unavailable", t("Removed from the library")]
          : keep.kind === "changed"
            ? ["unsaved", t("Changed in another tab")]
            : ["saved", t("Saved in the library")];
  return <SaveStatus state={state} label={label} />;
}

function Result(props: { result: GenerationResult }) {
  const t = useT();
  const { result } = props;
  return (
    <div className="flex flex-col gap-3 border-t pt-3.5" aria-live="polite">
      <CopyField label={t("Command")} value={result.command} />
      <CopyField
        label={t("Skin URL")}
        value={result.textureUrl ?? result.url}
        oneLine
      />
    </div>
  );
}

function CopyField(props: { label: string; value: string; oneLine?: boolean }) {
  const t = useT();
  const id = useId();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-sm font-medium">
        {props.label}
      </span>
      <div className="relative">
        <code
          aria-labelledby={id}
          title={props.oneLine ? props.value : undefined}
          className={cn(
            "block rounded-lg border bg-muted py-2 pr-10 pl-2.5 font-mono text-xs leading-relaxed",
            props.oneLine ? "truncate" : "break-all",
          )}
        >
          {props.value}
        </code>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute top-0.5 right-0.5"
          aria-label={t("Copy {item}", { item: props.label })}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(props.value);
              setCopied(true);
            } catch {
              toast.error(t("Failed to copy"));
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
        <output className="sr-only">
          {copied ? t("Copied to clipboard") : ""}
        </output>
      </div>
    </div>
  );
}

function LegacyDraftAlerts(props: { migrated?: string }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);
  if (props.migrated === "newer")
    return (
      <Alert>
        <AlertTitle>{t("A newer draft is waiting")}</AlertTitle>
        <AlertDescription>{t("Reload the page to open it.")}</AlertDescription>
      </Alert>
    );
  if (props.migrated !== "corrupt" || hidden) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("The old draft could not be read")}</AlertTitle>
      <AlertDescription>
        <Button
          size="sm"
          variant="outline"
          className="mt-1"
          onClick={() => {
            discardDraft(browserStorage("localStorage"));
            setHidden(true);
          }}
        >
          {t("Discard draft")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function TextureDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (reference: string) => void;
}) {
  const t = useT();
  const id = useId();
  const [value, setValue] = useState("");
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <LocalizedDialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) props.onOpen(value);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("Open texture URL")}</DialogTitle>
            <DialogDescription>
              {t("From textures.minecraft.net only.")}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={id}>{t("Texture URL or hash")}</FieldLabel>
            <Input
              id={id}
              value={value}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://textures.minecraft.net/texture/…"
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={!value.trim()}>
              {t("Open")}
            </Button>
          </DialogFooter>
        </form>
      </LocalizedDialogContent>
    </Dialog>
  );
}
