"use client";

import { isMessageKey, type MessageKey } from "@/lib/messages";

import { useForm, useStore } from "@tanstack/react-form";
import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
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
import { AdvancedOptions } from "@/components/advanced-options";
import { CapePicker, MineSkinKeyField } from "@/components/cape-support-fields";
import { ModelSelector } from "@/components/model-selector";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocalizedDialogContent } from "@/components/localized-dialog";
import { useAsRef } from "@/hooks/use-as-ref";
import { runHttpEffect } from "@/lib/effect-http";
import {
  documentOf,
  EditorSession,
  type SaveResult,
} from "@/lib/editor-session";
import { useCapeAccess } from "@/lib/hooks/use-cape-access";
import { useLatestTask } from "@/lib/hooks/use-latest-task";
import { useSkinLibrary } from "@/lib/hooks/use-skin-library";
import { useSkinGallery } from "@/lib/hooks/use-skin-gallery";
import { useSkinSelection } from "@/lib/hooks/use-skin-selection";
import { useStudioGeneration } from "@/lib/hooks/use-studio-generation";
import { LocationWrite } from "@/lib/location-write";
import { createTemplate, MAX_SKIN_FILE_BYTES } from "@/lib/skin-document";
import { browserStorage, discardDraft, readHandoff } from "@/lib/skin-draft";
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
  MAX_GALLERY_QUERY,
  readSkinFileTexture,
  skinSource,
  studioSearch,
  suggestSkinName,
  withGallerySkin,
  withoutSkinReference,
  type SkinSource,
  type StudioEntry,
  type StudioPurpose,
  type StudioSearch,
} from "@/lib/studio";
import {
  defaultStudioOptions,
  NO_CAPE_VALUE,
  normalizeStudioOptions,
  studioOptionErrors,
  type CapeStatus,
  type StudioOptions,
  type UploadMethod,
} from "@/lib/studio-options";
import type { GenerationResult } from "@/lib/studio-generation";
import { useLocale, useNotificationT, useT } from "@/lib/i18n-react";
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
    guide: "features/custom-skins",
  },
};

const panel =
  "min-w-0 rounded-xl border bg-card p-3 text-card-foreground sm:p-4";

/** Typed gallery search reaches the URL after this pause. */
const QUERY_WRITE_MS = 400;

/** One pixel store and library session for the whole Studio visit. */
function useEditorSession() {
  const [editor] = useState(() => {
    const store = new SkinEditorStore();
    // The server renders without a library; the browser opens it.
    const session = new EditorSession(store, browserLibrary());
    session.start(createTemplate("classic"), { name: "New skin" });
    return { store, session };
  });
  useEffect(() => () => void editor.session.dispose(), [editor]);
  return editor;
}

type Mode =
  | { readonly kind: "view" }
  | {
      readonly kind: "edit";
      readonly isNew: boolean;
      /** The `studioEditor` mark of this editor's history entry. */
      readonly entry: string;
    };

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
  const notify = useNotificationT();
  const locale = useLocale();
  const router = useRouter();
  const navigate = useNavigate();
  const { search } = props;
  const selection = useSkinSelection();
  const { store, state } = selection;
  const library = useSkinLibrary();
  const editor = useEditorSession();
  const generation = useStudioGeneration();
  const importTask = useLatestTask();
  /** Only URL-owned reads are cancelled when their reference is removed. */
  const urlImport = useRef(false);
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [drawer, setDrawer] = useState(false);
  const [textureDialog, setTextureDialog] = useState(false);
  const [dragging, setDragging] = useState(false);
  /** A gallery skin from the URL that waits for the catalog. */
  const [wantedGallery, setWantedGallery] = useState<string>();
  const [pendingGallery, setPendingGallery] = useState<string>();
  const [galleryError, setGalleryError] = useState<MessageKey>();
  const source = skinSource(search);
  const gallery = useSkinGallery(
    source === "gallery" || wantedGallery !== undefined,
  );
  const pngInput = useRef<HTMLInputElement>(null);
  const skinFileInput = useRef<HTMLInputElement>(null);
  const current = state.selection;

  /**
   * Change the public URL state. A new selection adds a history entry;
   * everything else replaces the current one and keeps its editor mark.
   * These navigations never replace unsaved work, so they skip the blocker.
   */
  const updateSearch = (
    update: (search: StudioSearch) => StudioSearch,
    history: "push" | "replace" = "replace",
  ) =>
    navigate({
      to: ".",
      search: (prev: StudioSearch) => studioSearch({ ...update(prev) }),
      replace: history === "replace",
      state: history === "replace" ? (prev) => prev : {},
      resetScroll: false,
      ignoreBlocker: true,
    });

  /** A local skin is selected: the URL no longer names a public skin. */
  const dropSkinReference = () => {
    if (search.skin || search.texture || search.handoff)
      void updateSearch(withoutSkinReference);
  };

  const updateSearchRef = useAsRef(updateSearch);

  // Gallery search: the input and filter follow each key press at once, the
  // URL after a pause. Back, Forward, and links bring their own text.
  const [query, setQuery] = useState(search.q ?? "");
  const writtenQuery = useRef(search.q);
  const historyIndex = useRouterState({
    select: (routerState) => routerState.location.state.__TSR_index,
  });
  const queryLocation = JSON.stringify([
    historyIndex,
    source,
    search.skin,
    search.texture,
    search.handoff,
  ]);
  const previousQueryLocation = useRef(queryLocation);
  const [queryWrite] = useState(
    () =>
      new LocationWrite<string | undefined>(
        () =>
          router.history.location.state.__TSR_key ??
          router.history.location.href,
        (q) => {
          writtenQuery.current = q;
          void updateSearchRef.current((prev) => ({ ...prev, q }));
        },
        QUERY_WRITE_MS,
      ),
  );
  useEffect(() => () => queryWrite.cancel(), [queryWrite]);
  useEffect(() => {
    const moved = previousQueryLocation.current !== queryLocation;
    previousQueryLocation.current = queryLocation;
    if (!moved && search.q === writtenQuery.current) return;
    writtenQuery.current = search.q;
    queryWrite.cancel();
    setQuery(search.q ?? "");
  }, [search.q, queryLocation, queryWrite]);
  const changeQuery = (value: string) => {
    setQuery(value);
    const q = value.trim().slice(0, MAX_GALLERY_QUERY).trim() || undefined;
    queryWrite.schedule(q);
  };
  const changeSource = (next: SkinSource) => {
    queryWrite.cancel();
    const q =
      next === "gallery" ? query.trim().slice(0, MAX_GALLERY_QUERY) : "";
    writtenQuery.current = q || undefined;
    void updateSearch((prev) => ({
      ...prev,
      source: next,
      q: q || undefined,
    }));
  };

  // A phone drawer has no place on wider screens.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 640px)");
    const close = () => {
      if (wide.matches) setDrawer(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  const cancelImport = () => {
    urlImport.current = false;
    setWantedGallery(undefined);
    setPendingGallery(undefined);
    setGalleryError(undefined);
    importTask.cancel();
  };

  // Offer drafts from earlier visits or other tabs.
  useEffect(() => {
    void editor.session.loadRecovery();
  }, [editor.session]);

  // ---- Editor history entry ----

  const editorMark = useRouterState({
    select: (routerState) => routerState.location.state.studioEditor,
  });
  const editorLocation = useRouterState({
    select: (routerState) => routerState.location.state.__TSR_key,
  });
  /** The entry this editor has reached, so leaving it closes the editor. */
  const reachedEntry = useRef<string>(undefined);
  const reachedLocation = useRef<string>(undefined);
  /** The entry Cancel or Save is going back from. */
  const leavingEntry = useRef<string>(undefined);

  const openEditor = (isNew: boolean) => {
    const entry = crypto.randomUUID();
    setDrawer(false);
    setMode({ kind: "edit", isNew, entry });
    void navigate({
      to: ".",
      search: true,
      state: { studioEditor: entry },
      resetScroll: false,
      ignoreBlocker: true,
    });
  };

  const closeEditor = () => {
    setMode({ kind: "view" });
    // A new session id, so kept drafts show as recoverable work.
    editor.session.start(createTemplate("classic"), {
      name: t("common.newSkin"),
    });
    void editor.session.loadRecovery();
  };

  /** Cancel or Save: close the editor and go back to the view's entry. */
  const exitEdit = (then?: () => void) => {
    const entry = mode.kind === "edit" ? mode.entry : undefined;
    closeEditor();
    if (!entry || router.history.location.state.studioEditor !== entry) {
      then?.();
      return;
    }
    leavingEntry.current = entry;
    if (then) {
      const stop = router.history.subscribe(() => {
        stop();
        then();
      });
    }
    router.history.back({ ignoreBlocker: true });
  };

  useEffect(() => {
    if (leavingEntry.current && editorMark !== leavingEntry.current)
      leavingEntry.current = undefined;
    if (mode.kind === "edit") {
      if (editorMark === mode.entry && reachedEntry.current !== mode.entry) {
        reachedEntry.current = mode.entry;
        reachedLocation.current = editorLocation;
      }
      // Back, Forward, or a link left the editor's entry. The blocker has
      // already asked about unsaved changes. A navigation can retain the
      // editor mark while still creating a different history entry.
      else if (
        reachedEntry.current === mode.entry &&
        (editorMark !== mode.entry ||
          editorLocation !== reachedLocation.current)
      )
        closeEditor();
      return;
    }
    // Forward or a reload reached an editor entry of a closed editor. Its
    // work is in drafts, so show the view instead of a different skin.
    if (editorMark && editorMark !== leavingEntry.current)
      void navigate({
        to: ".",
        search: true,
        replace: true,
        state: ({ studioEditor: _closed, ...rest }) => rest,
        resetScroll: false,
        ignoreBlocker: true,
      });
    // closeEditor and navigate are stable for this purpose.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMark, editorLocation, mode]);

  // ---- Public skin references from the URL ----

  /** Download a trusted texture, keep it in the library, and select it. */
  const importTexture = (reference: string, fromUrl = false) => {
    cancelImport();
    urlImport.current = fromUrl;
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
        if (skin) store.selectSkin(skin);
        else
          store.select(new File([png], `${name}.png`, { type: "image/png" }), {
            origin: "file",
            name,
          });
        posthog.capture("editor_opened", { source: "texture_url" });
      },
      (cause) => toast.error(t.error(cause)),
    );
  };

  const importGallery = (skin: GallerySkin) => {
    cancelImport();
    urlImport.current = true;
    setPendingGallery(skin.id);
    void importTask.run(
      (signal) => runHttpEffect(loadTextureEffect(skin.textureUrl), signal),
      (result) => {
        setPendingGallery(undefined);
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
        setGalleryError("studio.gallerySkinCouldNotOpenedTryAgain");
      },
    );
  };

  /** A gallery skin named by the URL, once the catalog is ready. */
  const openGallerySkin = (id: string) => {
    if (gallery.state.status !== "ready") {
      cancelImport();
      urlImport.current = true;
      setWantedGallery(id);
      return;
    }
    const skin = gallery.state.skins.find((entry) => entry.id === id);
    if (skin) importGallery(skin);
    else {
      cancelImport();
      urlImport.current = true;
      setGalleryError("studio.skinNoLongerGallery");
    }
  };

  /** The editor's PNG from an older handoff link. */
  const openHandoff = (id: string) => {
    cancelImport();
    urlImport.current = true;
    void importTask.run(
      () => readHandoff(browserStorage("sessionStorage"), id),
      (handoff) => {
        if (!handoff) {
          toast.error(notify("studio.skinEditorNoLongerAvailableOpenEditor"));
          return;
        }
        store.select(handoff.file, {
          origin: "handoff",
          variant: handoff.variant,
        });
        // The handoff is used once; other URL state stays.
        void updateSearch(({ handoff: _used, ...rest }) => rest);
      },
      () => toast.error(notify("studio.skinEditorCouldNotRead")),
    );
  };

  // Only a changed reference starts an import. Clearing it, or returning to
  // an entry for the same skin, keeps the current selection.
  const appliedReference = useRef<StudioSearch>({});
  useEffect(() => {
    const before = appliedReference.current;
    appliedReference.current = search;
    if (search.handoff) {
      if (search.handoff !== before.handoff) openHandoff(search.handoff);
    } else if (search.texture) {
      if (search.texture !== before.texture)
        importTexture(search.texture, true);
    } else if (search.skin) {
      if (search.skin !== before.skin) openGallerySkin(search.skin);
    } else if (urlImport.current) cancelImport();
    // The URL owns these imports; newer choices cancel them.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [search.handoff, search.texture, search.skin]);

  useEffect(() => {
    if (!wantedGallery || gallery.state.status !== "ready") return;
    openGallerySkin(wantedGallery);
    // Only the catalog arriving resolves the waiting link.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery.state, wantedGallery]);

  // ---- Choices in the page ----

  const openSkinFile = async (file: File) => {
    try {
      const { url, legacy } = readSkinFileTexture(await file.text());
      if (legacy)
        toast.warning(t("studio.fallingBackLegacySkinFormat"), {
          description: t("studio.pleaseUpdateSkinsrestorerSoonPossible"),
        });
      dropSkinReference();
      importTexture(url);
    } catch (cause) {
      toast.error(
        t("studio.failedReverseSkinFileError", {
          error: t.error(cause),
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
        name: t("common.newSkin"),
      });
      openEditor(true);
      posthog.capture("editor_opened", { source: "template" });
    },
    openSkinFile: () => skinFileInput.current?.click(),
    openTexture: () => setTextureDialog(true),
  };

  const choose = (skin: StoredSkin) => {
    cancelImport();
    store.selectSkin(skin);
    dropSkinReference();
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
      toast.error(t("studio.choosePngFilesUp5Mb"));
    if (fitting.length) {
      cancelImport();
      setDrawer(false);
      store.selectFiles(fitting.slice(0, 20));
      dropSkinReference();
    }
  };

  const openGallery = () => {
    if (source !== "gallery") changeSource("gallery");
    if (window.matchMedia("(max-width: 639px)").matches) setDrawer(true);
  };
  /** A click adds a history entry, so Back returns to the earlier skin. */
  const chooseGallery = (skin: GallerySkin) => {
    queryWrite.cancel();
    const update = (prev: StudioSearch) =>
      withGallerySkin({ ...prev, q: query }, skin.id);
    if (search.skin === skin.id) {
      void updateSearch(update);
      importGallery(skin);
    } else void updateSearch(update, "push");
  };

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
        dropSkinReference();
      },
      (cause) => toast.error(t.error(cause)),
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
        openEditor(current.origin === "gallery");
        posthog.capture("skin_edit_opened", { page: props.entry });
      },
      (cause) => toast.error(t.error(cause)),
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
    exitEdit(() =>
      updateSearch((prev) => ({
        ...withoutSkinReference(prev),
        source: "library",
      })),
    );
  };

  // ---- Command options ----

  const fixed = fixedPurpose(props.entry, search.intent);
  const capeStatusRef = useRef<CapeStatus>("granted");
  const purposeRef = useRef<StudioPurpose>("skin-url");
  const submitRef = useRef<(options: StudioOptions) => Promise<void>>(
    async () => {},
  );
  const form = useForm({
    defaultValues: defaultStudioOptions,
    validators: {
      onChange: ({ value }) => optionErrors(value),
      onSubmit: ({ value }) => optionErrors(value),
    },
    onSubmit: ({ value }) => submitRef.current(value),
  });
  function optionErrors(value: StudioOptions) {
    const fields = studioOptionErrors(value, {
      purpose: purposeRef.current,
      capeStatus: capeStatusRef.current,
    });
    return Object.keys(fields).length ? { fields } : undefined;
  }
  const options = useStore(form.store, (formState) => formState.values);
  const submitting = useStore(
    form.store,
    (formState) => formState.isSubmitting,
  );
  const submitted = useStore(
    form.store,
    (formState) => formState.submissionAttempts > 0,
  );
  const purpose = fixed ?? options.purpose;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const capes = useCapeAccess({ keyRequired: options.method === "mineskin" });
  purposeRef.current = purpose;
  capeStatusRef.current = capes.status;
  // A fixed purpose or a key check changes which checks apply.
  useEffect(() => {
    void form.validate("change");
  }, [form, purpose, capes.status]);

  // Generation: the input is everything the result depends on.
  const normalized = normalizeStudioOptions(options, purpose);
  const input: GenerationInput | null = selection.file
    ? {
        purpose,
        file: selection.file,
        variant: state.variant,
        method: normalized.method,
        capeUuid: normalized.capeUuid,
        name: normalized.name,
      }
    : null;
  const shown = generation.for(input);
  const nameInvalid =
    studioOptionErrors(options, { purpose, capeStatus: capes.status })
      .customName !== undefined;
  // Any change to the inputs stops waiting for a pending upload.
  useEffect(
    () => () => generation.cancel(),
    [
      generation,
      purpose,
      selection.file,
      state.variant,
      normalized.method,
      normalized.capeUuid,
      normalized.apiKey,
      normalized.name,
    ],
  );

  // The button submits the native form, so Enter in a field works too.
  // Nothing uploads before this, and a failure is never sent again on its own.
  submitRef.current = async (value) => {
    const chosen = normalizeStudioOptions(value, purpose);
    if (!input || pendingGallery) return;
    const exact: GenerationInput = { ...input, ...chosen, purpose };
    const fromEditor =
      current?.origin === "handoff" || current?.origin === "editor";
    const cape =
      chosen.capeUuid === NO_CAPE_VALUE ? undefined : chosen.capeUuid;
    await generation.generate(exact, {
      file: exact.file,
      variant: exact.variant,
      name: exact.name || undefined,
      capeUuid: cape,
      apiKey: chosen.apiKey || undefined,
      useCapeProxy: chosen.method === "axolotl" && cape !== undefined,
    });
    if (fromEditor && generation.for(exact).status === "done")
      posthog.capture("editor_handoff_completed", {
        target: purpose === "createcustom" ? "generator" : "upload",
      });
  };

  const chooseCape = (value: string) => {
    if (
      value !== NO_CAPE_VALUE &&
      options.method === "mineskin" &&
      !capes.keyGranted
    ) {
      toast.warning(t("studio.enterVerifyApiKeyBeforeSelectingCape"));
      return;
    }
    form.setFieldValue("capeUuid", value);
  };

  const editing = mode.kind === "edit";
  const info = intro[props.entry];

  const libraryView = (layout: "rail" | "drawer", close?: React.ReactNode) => (
    <Tabs
      className="group/tabs"
      orientation={layout === "rail" ? "vertical" : "horizontal"}
      value={source}
      onValueChange={(value) => changeSource(value as SkinSource)}
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
          hideHeading
        />
      </TabsContent>
      <TabsContent value="gallery">
        <StudioGallery
          state={gallery.state}
          query={query}
          onQuery={changeQuery}
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
            {t("studio.readGuide")}
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
          <StudioEditor
            store={editor.store}
            session={editor.session}
            isNew={mode.isNew}
            onSaved={saved}
            onExit={() => exitEdit()}
          />
        ) : (
          <>
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
                (wantedGallery && gallery.state.status === "error")) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(galleryError ?? "gallery.galleryCouldNotLoadedTryAgain")}
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
                        ? "common.tryAgain"
                        : "common.browseGallery",
                    )}
                  </Button>
                </Alert>
              )}
              <DraftRecovery
                session={editor.session}
                onContinue={() =>
                  openEditor(!editor.session.getSnapshot().target.skinId)
                }
              />
              {current ? (
                <SelectedSkinView
                  selection={current}
                  variant={state.variant}
                  previewUrl={state.previewUrl}
                  capeUrl={
                    capes.supportedCapes.find(
                      (cape) => cape.uuid === options.capeUuid,
                    )?.url
                  }
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
                    </div>
                  </Empty>
                </div>
              )}
            </section>

            <section
              aria-label={t("studio.options")}
              className={cn(panel, "flex flex-col gap-4")}
            >
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void form.handleSubmit();
                }}
              >
                <FieldGroup>
                  {fixed ? (
                    <h2 className="text-base font-semibold">
                      {fixed === "createcustom"
                        ? t("studio.createCustomSkin")
                        : t("common.useServer")}
                    </h2>
                  ) : (
                    <form.Field name="purpose">
                      {(field) => (
                        <ToggleGroup
                          aria-label={t("studio.purpose")}
                          variant="outline"
                          spacing={0}
                          className="grid w-full grid-cols-2"
                          value={[field.state.value]}
                          onValueChange={(value) => {
                            if (value[0])
                              field.handleChange(value[0] as StudioPurpose);
                          }}
                        >
                          <ToggleGroupItem value="skin-url" className="w-full">
                            {t("common.useServer")}
                          </ToggleGroupItem>
                          <ToggleGroupItem
                            value="createcustom"
                            className="w-full"
                          >
                            {t("studio.customSkin")}
                          </ToggleGroupItem>
                        </ToggleGroup>
                      )}
                    </form.Field>
                  )}

                  {purpose === "createcustom" && (
                    <form.Field name="customName">
                      {(field) => (
                        <TextField
                          label={t("studio.skinNameOptional")}
                          value={field.state.value}
                          placeholder={
                            (current && suggestSkinName(current.name)) ||
                            "cool_skin_name"
                          }
                          errors={
                            field.state.meta.isTouched || submitted
                              ? field.state.meta.errors
                              : []
                          }
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                        />
                      )}
                    </form.Field>
                  )}

                  <ChoiceSet label={t("common.model")}>
                    {(labelId) => (
                      <ModelSelector
                        aria-labelledby={labelId}
                        layout="stacked"
                        value={state.variant}
                        onValueChange={(value) => store.setVariant(value)}
                      />
                    )}
                  </ChoiceSet>

                  <form.Field name="capeUuid">
                    {(field) => (
                      <ChoiceSet
                        label={t("studio.cape")}
                        errors={submitted ? field.state.meta.errors : []}
                      >
                        {(labelId) => (
                          <CapePicker
                            labelledBy={labelId}
                            capeOptionsDisabled={capes.capeOptionsDisabled}
                            supportedCapes={capes.supportedCapes}
                            selectedCapeUuid={field.state.value}
                            onCapeChange={chooseCape}
                            keyHint={
                              options.method === "mineskin" &&
                              capes.status !== "granted" && (
                                <p className="text-xs text-muted-foreground">
                                  {t("studio.loadCapeSupportValidApiKeyUnder")}{" "}
                                  {!advancedOpen && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      onClick={() => setAdvancedOpen(true)}
                                    >
                                      {t("studio.openAdvancedOptions")}
                                    </Button>
                                  )}
                                </p>
                              )
                            }
                          />
                        )}
                      </ChoiceSet>
                    )}
                  </form.Field>
                </FieldGroup>

                <form.Field
                  name="method"
                  listeners={{
                    onChange: ({ value }) => {
                      // Official needs a checked key to apply a cape.
                      if (value === "mineskin" && !capes.keyGranted)
                        form.setFieldValue("capeUuid", NO_CAPE_VALUE);
                    },
                  }}
                >
                  {(methodField) => (
                    <AdvancedOptions
                      method={methodField.state.value}
                      onMethodChange={(value: UploadMethod) =>
                        methodField.handleChange(value)
                      }
                      open={advancedOpen}
                      onOpenChange={setAdvancedOpen}
                      officialFields={
                        <form.Field
                          name="apiKey"
                          listeners={{
                            onChange: () => {
                              // A new key needs a new check before capes.
                              capes.reset();
                              form.setFieldValue("capeUuid", NO_CAPE_VALUE);
                            },
                          }}
                        >
                          {(field) => (
                            <MineSkinKeyField
                              value={field.state.value}
                              status={capes.status}
                              onChange={field.handleChange}
                              onBlur={field.handleBlur}
                              onCheckCapeAccess={() =>
                                void capes.verify(field.state.value.trim())
                              }
                            />
                          )}
                        </form.Field>
                      }
                    />
                  )}
                </form.Field>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !input ||
                    !!pendingGallery ||
                    nameInvalid ||
                    submitting ||
                    shown.status === "pending"
                  }
                  title={current ? undefined : t("studio.selectSkinFirst")}
                >
                  {shown.status === "pending" && (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  {shown.status === "pending"
                    ? t("studio.generating")
                    : purpose === "createcustom"
                      ? t("studio.generateSrCreatecustom")
                      : t("studio.generateSkinUrl")}
                </Button>
              </form>

              {shown.status === "failed" && (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>
                    {t("studio.failedUploadSkinError", {
                      error: t.message(shown.message),
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
        aria-label={t("studio.selectSkinPngFiles")}
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
    </main>
  );
}

/** A labelled group of choices, such as the model or the cape. */
function ChoiceSet(props: {
  label: string;
  errors?: readonly unknown[];
  children: (labelId: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <FieldSet>
      <FieldLegend id={id} variant="label">
        {props.label}
      </FieldLegend>
      {props.children(id)}
      <LocalizedFieldError errors={props.errors} />
    </FieldSet>
  );
}

/** A text field with a label and its validation messages. */
function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  errors?: readonly unknown[];
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  const id = useId();
  const invalid = !!props.errors?.length;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
      <Input
        id={id}
        value={props.value}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={props.onBlur}
      />
      <LocalizedFieldError errors={props.errors} />
    </Field>
  );
}

/** Validation messages use stable keys; show them in the page language. */
function LocalizedFieldError(props: { errors?: readonly unknown[] }) {
  const t = useT();
  return (
    <FieldError
      errors={props.errors
        ?.filter(isMessageKey)
        .map((message) => ({ message: t(message) }))}
    />
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
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          disabled={!editable}
          title={
            selection.status === "ready" && !editable
              ? t("studio.only64646432Skins")
              : undefined
          }
          onClick={props.onEdit}
        >
          <Pencil data-icon="inline-start" />
          {t("studio.editSkin")}
        </Button>
        {props.onKeep && (
          <Button
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
        {props.galleryLink && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("common.copyGalleryLink")}
              title={t("common.copyGalleryLink")}
              onClick={() =>
                void navigator.clipboard
                  .writeText(
                    new URL(props.galleryLink!, window.location.origin).href,
                  )
                  .then(
                    () => setCopied(true),
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

function Result(props: { result: GenerationResult }) {
  const t = useT();
  const { result } = props;
  return (
    <div className="flex flex-col gap-3 border-t pt-3.5" aria-live="polite">
      <CopyField label={t("studio.command")} value={result.command} />
      <CopyField
        label={t("studio.skinUrl")}
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
          aria-label={t("studio.copyItem", { item: props.label })}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(props.value);
              setCopied(true);
            } catch {
              toast.error(t("common.failedCopy"));
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
        <output className="sr-only">
          {copied ? t("common.copiedClipboard") : ""}
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
    onSubmit: ({ value }) => props.onOpen(value.reference.trim()),
  });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <LocalizedDialogContent>
        <form
          className="flex flex-col gap-4"
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
          <form.Field
            name="reference"
            validators={{
              onSubmit: ({ value }) =>
                value.trim() ? undefined : "common.textureUrlHash",
            }}
          >
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
                    onChange={(event) => field.handleChange(event.target.value)}
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
