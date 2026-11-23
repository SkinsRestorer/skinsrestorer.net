"use client";

import type { MessageKey } from "@/lib/messages";

import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  Check,
  Download,
  FileArchive,
  FolderPlus,
  Images,
  Link2,
  PanelLeft,
  Pencil,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { analytics } from "@/lib/analytics";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalizedDialogContent } from "@/components/localized-dialog";
import { useAsRef } from "@/hooks/use-as-ref";
import {
  documentOf,
  EditorSession,
  type SaveResult,
} from "@/lib/editor-session";
import { useSkinLibrary, downloadSkin } from "@/lib/hooks/use-skin-library";
import { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import {
  createTemplate,
  exportSkinPng,
  MAX_SKIN_FILE_BYTES,
} from "@/lib/skin-document";
import { browserStorage, discardDraft, readDraft } from "@/lib/skin-draft";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import { browserLibrary, withLibrary } from "@/lib/skin-library-client";
import { prepareSkinContent, type StoredSkin } from "@/lib/skin-library";
import { selectionEditable, type SelectedSkin } from "@/lib/skin-selection";
import { galleryPermalink, type GallerySkin } from "@/lib/skin-gallery";
import {
  readSkinFileTexture,
  withGallerySkin,
  withoutSkinReference,
  type StudioEntry,
  type StudioSearch,
} from "@/lib/studio";
import { useLocale, useT } from "@/lib/i18n-react";
import { cn, findOption } from "@/lib/utils";
import { SkinThumbnail } from "./skin-thumbnail";
import { DraftRecovery } from "./draft-recovery";
import { StudioCommandOptions } from "./studio-command-options";
import { StudioGallery } from "./studio-gallery";
import {
  AddSkinMenu,
  StudioLibrary,
  type LibraryCommands,
} from "./studio-library";
import { useEditorHistoryEntry } from "./use-editor-history-entry";
import { useStudioCommandForm } from "./use-studio-command-form";
import { useStudioSearch } from "./use-studio-search";
import { useStudioUrlImports } from "./use-studio-url-imports";

// The 3D view and the editor bring in three.js. Load them after hydration
// so the upload form works sooner.
const loadSkinView = () => import("./skin-view");
const SkinView = lazy(() =>
  loadSkinView().then((module) => ({ default: module.SkinView })),
);
const StudioEditor = lazy(() =>
  import("./studio-editor").then((module) => ({
    default: module.StudioEditor,
  })),
);

/**
 * Fetch the 3D view once the page is idle, so it is ready when someone
 * picks a skin without competing with the first render. A failed prefetch
 * is retried when the view renders.
 */
function usePrefetchSkinView() {
  useEffect(() => {
    const prefetch = () => {
      loadSkinView().catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetch, { timeout: 10_000 });
      return () => {
        window.cancelIdleCallback(id);
      };
    }
    const timer = setTimeout(prefetch, 2000);
    return () => {
      clearTimeout(timer);
    };
  }, []);
}

const intro: Record<
  StudioEntry,
  { title: MessageKey; description: MessageKey; guide: string }
> = {
  studio: {
    title: "studio.title",
    description: "studio.description",
    guide: "features/skin-editor",
  },
  upload: {
    title: "upload.title",
    description: "upload.description",
    guide: "features/skin-upload",
  },
  generator: {
    title: "generator.title",
    description: "generator.description",
    guide: "configuration/custom-skins",
  },
};

const panel =
  "min-w-0 rounded-xl border bg-card p-3 text-card-foreground sm:p-4";

/** SkinsRestorer storage files. The picker lists only these where it can. */
const SKIN_FILE_ACCEPT = ".playerskin,.urlskin,.customskin,.legacyskin,.skin";

/**
 * iOS and iPadOS map `accept` to system file types. These extensions have
 * none, so Safari greys out every file. There the picker lists all files,
 * and opening checks the content instead.
 */
function skinFileAccept() {
  const { userAgent, maxTouchPoints } = navigator;
  const appleTouch =
    /iPad|iPhone|iPod/u.test(userAgent) ||
    (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  return appleTouch ? "" : SKIN_FILE_ACCEPT;
}

/** One pixel store and library session for the whole Studio visit. */
function useEditorSession() {
  const t = useT();
  // Read on each copy, so copies follow a language switch.
  const locale = useAsRef(useLocale());
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [editor] = useState(() => {
    const store = new SkinEditorStore();
    // The server renders without a library; the browser opens it.
    const session = new EditorSession(store, browserLibrary(), {
      locale: () => locale.current,
    });
    session.start(createTemplate("classic"), { name: t("common.newSkin") });
    return { store, session };
  });
  useEffect(() => () => void editor.session.dispose(), [editor]);
  return editor;
}

/**
 * The editor in the center and options columns. Its props are stable, so
 * Studio renders for the library, the selection, or the URL do not render
 * the editor while the user paints.
 */
const StudioEditorPane = memo(function StudioEditorPane(props: {
  store: SkinEditorStore;
  session: EditorSession;
  isNew: boolean;
  onSaved: (result: Extract<SaveResult, { kind: "saved" }>) => void;
  onExit: () => void;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-[480px]" />}>
      <StudioEditor
        store={props.store}
        session={props.session}
        isNew={props.isNew}
        onSaved={props.onSaved}
        onExit={props.onExit}
      />
    </Suspense>
  );
});

/**
 * The Studio: the library on the left, the selected skin in 3D in the
 * center, and the options for its command on the right. Upload and
 * Generator render it with a fixed purpose. Gallery and texture imports read
 * public images; the selected skin uploads only through the generate button.
 *
 * Public choices live in the URL: the gallery skin, a texture link, the
 * list shown, and the gallery search. Library skins and the API key never
 * do. The editor has its own history entry, so Back returns to the view.
 */
export function SkinStudio(props: {
  entry: StudioEntry;
  search: StudioSearch;
}) {
  const t = useT();
  const locale = useLocale();
  const { search } = props;
  const selection = useSkinSelection();
  const { store, state } = selection;
  const library = useSkinLibrary();
  const editor = useEditorSession();
  usePrefetchSkinView();
  const [drawer, setDrawer] = useState(false);
  const [textureDialog, setTextureDialog] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pngInput = useRef<HTMLInputElement>(null);
  const skinFileInput = useRef<HTMLInputElement>(null);
  const current = state.selection;

  const url = useStudioSearch(search);
  const { source, updateSearch, dropSkinReference } = url;
  const imports = useStudioUrlImports({
    search,
    source,
    store,
    client: library.client,
    updateSearch,
    onGalleryOpened: () => {
      setDrawer(false);
    },
  });
  const { gallery, cancelImport, importTexture } = imports;

  /** Where focus goes once the next view has rendered. */
  const focusAfter = useRef<"selection" | "edit" | null>(null);
  const focusIds = useId();
  const selectionHeadingId = `${focusIds}-selection`;
  const editButtonId = `${focusIds}-edit`;
  const keepButtonId = `${focusIds}-keep`;

  const editorEntry = useEditorHistoryEntry(() => {
    // The editor unmounts with its focused control: return to Edit skin.
    focusAfter.current = "edit";
    // A new session id, so kept drafts show as recoverable work.
    editor.session.start(createTemplate("classic"), {
      name: t("common.newSkin"),
    });
  });
  const { mode } = editorEntry;
  const openEditor = (isNew: boolean) => {
    setDrawer(false);
    editorEntry.openEditor(isNew);
  };

  useEffect(() => {
    const id =
      focusAfter.current === "edit"
        ? editButtonId
        : focusAfter.current === "selection"
          ? selectionHeadingId
          : undefined;
    // useId() values contain characters that CSS selectors must escape.
    const element = id ? document.querySelector(`#${CSS.escape(id)}`) : null;
    const target = element instanceof HTMLElement ? element : null;
    if (mode.kind === "edit") return;
    // Without an Edit skin button there is nothing to return to.
    if (!target && focusAfter.current === "edit") focusAfter.current = null;
    if (!target) return;
    focusAfter.current = null;
    target.focus();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- A new selection renders the element that takes focus.
  }, [mode.kind, current?.token, editButtonId, selectionHeadingId]);

  // A phone drawer has no place on wider screens.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 640px)");
    const close = () => {
      if (wide.matches) setDrawer(false);
    };
    wide.addEventListener("change", close);
    return () => {
      wide.removeEventListener("change", close);
    };
  }, []);

  // ---- Choices in the page ----

  const openSkinFile = async (file: File) => {
    try {
      const { url: texture, legacy } = readSkinFileTexture(await file.text());
      dropSkinReference();
      // Warn about the old format only once its skin actually opened.
      importTexture(texture, false, () => {
        if (legacy)
          toast.warning(t("studio.fallingBackLegacySkinFormat"), {
            description: t("studio.pleaseUpdateSkinsrestorerSoonPossible"),
          });
      });
    } catch (cause) {
      toast.error(t("studio.skinFileCouldNotOpen"), {
        description: `${t.error(cause)} ${t("studio.skinFileHint")}`,
      });
    }
  };

  const commands: LibraryCommands = {
    upload: () => pngInput.current?.click(),
    create: () => {
      // A newer choice owns the workspace: drop pending imports and decodes.
      cancelImport();
      editor.session.start(createTemplate(state.variant), {
        name: t("common.newSkin"),
      });
      openEditor(true);
      void analytics.capture("editor_opened", { source: "template" });
    },
    openSkinFile: () => {
      const input = skinFileInput.current;
      if (!input) return;
      input.accept = skinFileAccept();
      input.click();
    },
    openTexture: () => {
      setTextureDialog(true);
    },
  };

  const choose = (skin: StoredSkin) => {
    cancelImport();
    store.selectSkin(skin);
    dropSkinReference();
    setDrawer(false);
    void analytics.capture("skin_library_action", { action: "select" });
  };

  const selectFiles = (files: readonly File[]) => {
    const pngs = files.filter(
      (file) => file.type === "image/png" || /\.png$/iu.test(file.name),
    );
    const rejected = files.length - pngs.length;
    const fitting = pngs.filter((file) => file.size <= MAX_SKIN_FILE_BYTES);
    if (rejected || fitting.length < pngs.length)
      toast.error(t("studio.choosePngFilesUp5Mb"));
    if (fitting.length > 0) {
      cancelImport();
      setDrawer(false);
      // The button that opened the file picker can unmount with the empty
      // view, so move focus to the new selection.
      focusAfter.current = "selection";
      store.selectFiles(fitting.slice(0, 20));
      dropSkinReference();
    }
  };

  const openGallery = () => {
    if (source !== "gallery") url.changeSource("gallery");
    if (window.matchMedia("(max-width: 639px)").matches) setDrawer(true);
  };
  /** A click adds a history entry, so Back returns to the earlier skin. */
  const chooseGallery = (skin: GallerySkin) => {
    url.cancelQueryWrite();
    const update = (prev: StudioSearch) =>
      withGallerySkin({ ...prev, q: url.query }, skin.id);
    if (search.skin === skin.id) {
      void updateSearch(update);
      imports.importGallery(skin);
    } else void updateSearch(update, "push");
  };

  const keepGallery = () => {
    if (current?.origin !== "gallery" || current.status !== "ready") return;
    const client = library.client;
    if (!client) return;
    const token = current.token;
    const variant = state.variant;
    cancelImport();
    void imports.task.run(
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
        // The save button unmounts with the gallery skin. Move focus to the
        // kept skin unless the user has moved it elsewhere.
        const active = document.activeElement;
        if (!active || active === document.body || active.id === keepButtonId)
          focusAfter.current = "selection";
        store.selectSkin(skin);
        dropSkinReference();
      },
      (cause) => {
        toast.error(t.error(cause));
      },
    );
  };
  const editSelected = () => {
    if (current?.status !== "ready") return;
    const { token } = current;
    cancelImport();
    void imports.task.run(
      () => documentOf(current.file, state.variant),
      (document) => {
        // Another skin was selected while this one was decoding.
        if (store.getSnapshot().selection?.token !== token) return;
        editor.session.start(document, {
          skinId: current.skinId,
          baseRevision: current.revision,
          name: current.name,
        });
        openEditor(current.origin === "gallery");
        void analytics.capture("skin_edit_opened", { page: props.entry });
      },
      (cause) => {
        toast.error(t.error(cause));
      },
    );
  };

  const saved = (result: Extract<SaveResult, { kind: "saved" }>) => {
    if (result.skin) store.selectSkin(result.skin, "editor");
    else
      store.select(result.file, {
        origin: "editor",
        variant: result.variant,
        name: result.name,
      });
    // The view's entry still names the gallery skin; replace it once Back
    // has reached it, so the saved skin stays selected.
    editorEntry.exitEdit(() => {
      void updateSearch((prev) => ({
        ...withoutSkinReference(prev),
        source: "library",
      }));
    });
  };
  // Stable callbacks keep the memoized editor pane from rendering again.
  const savedRef = useAsRef(saved);
  const exitRef = useAsRef(editorEntry.exitEdit);
  const onEditorSaved = useCallback(
    (result: Extract<SaveResult, { kind: "saved" }>) => {
      savedRef.current(result);
    },
    [savedRef],
  );
  const onEditorExit = useCallback(() => {
    exitRef.current();
  }, [exitRef]);

  const command = useStudioCommandForm({
    entry: props.entry,
    intent: search.intent,
    file: selection.file,
    variant: state.variant,
    current,
    pendingGallery: imports.pendingGallery,
  });

  const editing = mode.kind === "edit";
  const info = intro[props.entry];

  const libraryView = (layout: "rail" | "drawer", close?: React.ReactNode) => (
    <Tabs
      className="group/tabs"
      orientation={layout === "rail" ? "vertical" : "horizontal"}
      value={source}
      onValueChange={(value: unknown) => {
        const next = findOption(["library", "gallery"], value);
        if (next) url.changeSource(next);
      }}
    >
      {close && <div className="flex justify-end">{close}</div>}
      <TabsList className="w-full" aria-label={t("common.skinSources")}>
        <TabsTrigger
          className="h-auto w-full min-w-0 whitespace-normal"
          value="library"
        >
          {t("common.library")}
        </TabsTrigger>
        <TabsTrigger
          className="h-auto w-full min-w-0 whitespace-normal"
          value="gallery"
        >
          {t("common.gallery")}
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
        />
      </TabsContent>
      <TabsContent value="gallery">
        <StudioGallery
          state={gallery.state}
          query={url.query}
          onQuery={url.changeQuery}
          onRetry={gallery.retry}
          onSelect={chooseGallery}
          selectedId={current?.galleryId}
          pendingId={imports.pendingGallery}
          layout={layout}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 pt-4 pb-10 sm:pt-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-semibold tracking-tight">
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
            {t("studio.readGuide")}
          </Link>
        </p>
      </header>

      <div
        className={cn(
          "grid items-start gap-2 xl:gap-3",
          // The options wait for a skin, so the center takes their space.
          current || editing
            ? "sm:grid-cols-[108px_minmax(0,1fr)_236px] md:grid-cols-[132px_minmax(0,1fr)_272px] lg:grid-cols-[184px_minmax(0,1fr)_320px]"
            : "sm:grid-cols-[108px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)] lg:grid-cols-[184px_minmax(0,1fr)]",
        )}
      >
        <div className="flex items-center gap-2 sm:hidden">
          <Button
            variant="outline"
            disabled={editing}
            aria-expanded={drawer}
            onClick={() => {
              setDrawer(true);
            }}
          >
            <PanelLeft data-icon="inline-start" />
            {t(source === "gallery" ? "common.gallery" : "common.library")}
          </Button>
          <span className="ml-auto">
            <AddSkinMenu commands={commands} disabled={editing} />
          </span>
        </div>

        <aside
          aria-label={t("common.skinSources")}
          inert={editing || undefined}
          className={cn(
            panel,
            "hidden p-2.5 sm:sticky sm:top-20 sm:block sm:max-h-[calc(100dvh-6rem)] sm:overflow-y-auto sm:p-2.5",
            editing && "opacity-45",
          )}
        >
          {libraryView("rail")}
        </aside>

        {mode.kind === "edit" ? (
          <StudioEditorPane
            store={editor.store}
            session={editor.session}
            isNew={mode.isNew}
            onSaved={onEditorSaved}
            onExit={onEditorExit}
          />
        ) : (
          <>
            {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Dropping a file is a pointer shortcut; the file picker in this panel is the keyboard path. */}
            <section
              aria-label={t("common.skin")}
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
                const next = event.relatedTarget;
                if (
                  !(next instanceof Node && event.currentTarget.contains(next))
                )
                  setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                selectFiles([...event.dataTransfer.files]);
              }}
            >
              <LegacyDraftAlerts migrated={library.migrated?.status} />
              {(imports.galleryError !== undefined ||
                (imports.wantedGallery &&
                  gallery.state.status === "error")) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(
                      imports.galleryError ??
                        "gallery.galleryCouldNotLoadedTryAgain",
                    )}
                  </AlertDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (gallery.state.status === "error") gallery.retry();
                      else {
                        openGallery();
                        imports.clearGalleryError();
                      }
                    }}
                  >
                    {t(
                      gallery.state.status === "error"
                        ? "common.tryAgain"
                        : "common.browseGallery",
                    )}
                  </Button>
                </Alert>
              )}
              <DraftRecovery
                session={editor.session}
                library={library.client}
                libraryState={library.state}
                onContinue={() => {
                  openEditor(!editor.session.getSnapshot().target.skinId);
                }}
                onSavedSkin={(skin) => {
                  cancelImport();
                  store.selectSkin(skin);
                  dropSkinReference();
                }}
              />
              {current ? (
                <SelectedSkinView
                  selection={current}
                  variant={state.variant}
                  previewUrl={state.previewUrl}
                  capeUrl={command.capeUrl}
                  onEdit={editSelected}
                  onUseLatest={() => {
                    // The link unmounts with the notice: focus the new version.
                    focusAfter.current = "selection";
                    // oxlint-disable-next-line react/hooks -- `useLatest` is a store method, not a React hook.
                    store.useLatest();
                  }}
                  headingId={selectionHeadingId}
                  editButtonId={editButtonId}
                  keepButtonId={keepButtonId}
                  onKeep={
                    current.origin === "gallery" ? keepGallery : undefined
                  }
                  galleryLink={
                    current.galleryId
                      ? galleryPermalink(
                          current.galleryId,
                          locale,
                          command.fixed,
                        )
                      : undefined
                  }
                />
              ) : (
                <div className="flex h-[300px] rounded-lg border border-dashed sm:h-[360px]">
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>
                        <h2 className="text-base font-semibold">
                          {t("studio.noSkinSelected")}
                        </h2>
                      </EmptyTitle>
                    </EmptyHeader>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={commands.upload}>
                        <Upload data-icon="inline-start" />
                        {t("studio.uploadSkin")}
                      </Button>
                      <Button variant="outline" onClick={commands.create}>
                        <Pencil data-icon="inline-start" />
                        {t("common.createSkin")}
                      </Button>
                      <Button variant="outline" onClick={openGallery}>
                        <Images data-icon="inline-start" />
                        {t("common.browseGallery")}
                      </Button>
                      {props.entry === "generator" && (
                        <Button
                          variant="outline"
                          onClick={commands.openSkinFile}
                        >
                          <FileArchive data-icon="inline-start" />
                          {t("library.openSkinFile")}
                        </Button>
                      )}
                    </div>
                  </Empty>
                </div>
              )}
            </section>

            {current && (
              <section
                aria-label={t("studio.options")}
                className={cn(panel, "flex flex-col gap-4")}
              >
                <StudioCommandOptions
                  command={command}
                  current={current}
                  variant={state.variant}
                  onVariant={(value) => {
                    store.setVariant(value);
                  }}
                />
              </section>
            )}
          </>
        )}
      </div>

      <input
        ref={pngInput}
        type="file"
        accept=".png,image/png"
        multiple
        hidden
        aria-label={t("studio.selectSkinPngFiles")}
        onChange={(event) => {
          selectFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
      <input
        ref={skinFileInput}
        type="file"
        accept={SKIN_FILE_ACCEPT}
        hidden
        aria-label={t("studio.selectSkinFileReverse")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file && file.size <= MAX_SKIN_FILE_BYTES) void openSkinFile(file);
          else if (file) toast.error(t("studio.chooseFileUp5Mb"));
        }}
      />

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[min(16rem,82vw)] overflow-y-auto"
        >
          <SheetTitle className="sr-only">{t("common.skinSources")}</SheetTitle>
          <div className="p-3">
            {libraryView(
              "drawer",
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("studio.closeSkinBrowser")}
                  />
                }
              >
                <X />
              </SheetClose>,
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TextureDialog
        open={textureDialog}
        onOpenChange={setTextureDialog}
        onOpen={(reference) => {
          setTextureDialog(false);
          dropSkinReference();
          importTexture(reference);
        }}
      />
    </div>
  );
}

function SelectedSkinView(props: {
  selection: SelectedSkin;
  variant: "classic" | "slim";
  previewUrl: string | null;
  capeUrl?: string | undefined;
  onEdit: () => void;
  onUseLatest: () => void;
  onKeep?: (() => void) | undefined;
  galleryLink?: string | undefined;
  /** Element ids, so the Studio can move focus here after a view change. */
  headingId?: string;
  editButtonId?: string;
  keepButtonId?: string;
}) {
  const t = useT();
  const { selection, galleryLink } = props;
  const editable = selectionEditable(selection);
  const editHintId = useId();
  const editHint =
    selection.status === "ready" && !editable
      ? t("studio.only64646432Skins")
      : undefined;
  const [copied, setCopied] = useState(false);
  useEffect((): (() => void) | undefined => {
    if (!copied) return undefined;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 1400);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);
  return (
    <>
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 ph-no-capture">
        <h2
          id={props.headingId}
          tabIndex={-1}
          className="min-w-0 truncate text-base font-semibold outline-none"
        >
          {selection.name}
        </h2>
        {selection.status !== "invalid" &&
          selection.keep.kind !== "catalog" && (
            <KeepStatus selection={selection} />
          )}
        {selection.keep.kind === "changed" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {t("studio.changedSkinNotice")}
            <Button variant="link" size="sm" onClick={props.onUseLatest}>
              {t("studio.useNewVersion")}
            </Button>
          </span>
        )}
      </div>
      {selection.status === "invalid" ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{t("studio.fileCannotUsed")}</AlertTitle>
          <AlertDescription>
            {t.message(selection.error ?? "")}
          </AlertDescription>
        </Alert>
      ) : (
        <Suspense fallback={<Skeleton className="h-[300px] sm:h-[360px]" />}>
          <SkinView
            skinUrl={props.previewUrl}
            capeUrl={props.capeUrl}
            variant={props.variant}
            label={t("studio.name3dViewDragUseArrowKeys", {
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
        </Suspense>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          id={props.editButtonId}
          variant="outline"
          disabled={!editable}
          focusableWhenDisabled
          title={editHint}
          aria-describedby={editHint ? editHintId : undefined}
          onClick={props.onEdit}
        >
          <Pencil data-icon="inline-start" />
          {t("studio.editSkin")}
        </Button>
        {editHint && (
          <span id={editHintId} className="sr-only">
            {editHint}
          </span>
        )}
        {props.onKeep && (
          <Button
            id={props.keepButtonId}
            size="icon"
            variant="ghost"
            disabled={selection.status !== "ready"}
            aria-label={t("common.saveLibrary")}
            title={t("common.saveLibrary")}
            onClick={props.onKeep}
          >
            <FolderPlus />
          </Button>
        )}
        {galleryLink && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("common.copyGalleryLink")}
              title={t("common.copyGalleryLink")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(new URL(galleryLink, window.location.origin).href)
                  .then(
                    () => {
                      setCopied(true);
                      // The icon change alone is easy to miss.
                      toast.success(t("common.copiedClipboard"));
                    },
                    () => toast.error(t("common.failedCopy")),
                  )
              }
            >
              {copied ? <Check /> : <Link2 />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              disabled={selection.status !== "ready"}
              aria-label={t("common.downloadPng")}
              title={t("common.downloadPng")}
              onClick={() => {
                downloadSkin(selection.file, selection.name);
              }}
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
      ? ["saving", t("studio.savingLibrary")]
      : keep.kind === "off"
        ? [
            "unavailable",
            t("studio.notSavedError", { error: t.message(keep.message) }),
          ]
        : keep.kind === "removed"
          ? ["unavailable", t("studio.removedLibrary")]
          : keep.kind === "changed"
            ? ["unsaved", t("studio.changedAnotherTab")]
            : ["saved", t("studio.savedLibrary")];
  return <SaveStatus state={state} label={label} />;
}

function LegacyDraftAlerts(props: { migrated?: string | undefined }) {
  const t = useT();
  const locale = useLocale();
  const [hidden, setHidden] = useState(false);
  const downloadLegacyDraft = async () => {
    try {
      const draft = await readDraft(browserStorage("localStorage"));
      if (draft.status !== "found") {
        toast.error(t("studio.oldDraftCouldNotRead"));
        return;
      }
      const png = await exportSkinPng(draft.document.pixels);
      downloadSkin(
        new Blob([png], { type: "image/png" }),
        t("library.recoveredDraftName", {
          date: new Date(draft.updatedAt).toLocaleDateString(locale),
        }),
      );
    } catch (cause) {
      toast.error(t("studio.pngCouldNotMadeError", { error: t.error(cause) }));
    }
  };
  if (props.migrated === "unmoved")
    return (
      <Alert>
        <AlertTitle>{t("studio.oldDraftCouldNotMove")}</AlertTitle>
        <AlertDescription>
          {t("studio.oldDraftDownloadKeep")}
          <Button
            size="sm"
            variant="outline"
            className="mt-1"
            onClick={() => void downloadLegacyDraft()}
          >
            {t("studio.downloadDraft")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (props.migrated === "newer")
    return (
      <Alert>
        <AlertTitle>{t("studio.newerDraftWaiting")}</AlertTitle>
        <AlertDescription>{t("studio.reloadPageOpen")}</AlertDescription>
      </Alert>
    );
  if (props.migrated !== "corrupt" || hidden) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("studio.oldDraftCouldNotRead")}</AlertTitle>
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
          {t("studio.discardDraft")}
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
  const form = useForm({
    defaultValues: { reference: "" },
    onSubmit: ({ value, formApi }) => {
      props.onOpen(value.reference.trim());
      // The next open starts empty instead of showing the last link.
      formApi.reset();
    },
  });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <LocalizedDialogContent>
        <form
          // The typed link names a texture; keep it out of session replays.
          className="flex flex-col gap-4 ph-no-capture"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("common.openTextureUrl")}</DialogTitle>
            <DialogDescription>
              {t("studio.texturesMinecraftNetOnly")}
            </DialogDescription>
          </DialogHeader>
          <form.Field name="reference">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={id}>
                  {t("common.textureUrlHash")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Link2 aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={id}
                    value={field.state.value}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="https://textures.minecraft.net/texture/…"
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    onBlur={field.handleBlur}
                  />
                </InputGroup>
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <form.Subscribe
              selector={(formState) => formState.values.reference.trim() !== ""}
            >
              {(filled) => (
                <Button type="submit" disabled={!filled}>
                  {t("studio.open")}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </LocalizedDialogContent>
    </Dialog>
  );
}
