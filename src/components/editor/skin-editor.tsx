"use client";

import { useBlocker, useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  Copy,
  Download,
  Grid3x3,
  Maximize,
  Save,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import posthog from "posthog-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { useAsRef } from "@/hooks/use-as-ref";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorPanel, toHex } from "@/components/editor/color-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import type { EditorInteraction } from "@/components/editor/editor-types";
import { LayersPanel } from "@/components/editor/layers-panel";
import { ModelCanvas } from "@/components/editor/model-canvas";
import { OpenSkinPanel } from "@/components/editor/open-skin-panel";
import { SkinIssueAlerts } from "@/components/editor/skin-issue-alerts";
import { TextureCanvas } from "@/components/editor/texture-canvas";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { CustomTimeAgo } from "@/components/time-ago";
import {
  documentOf,
  EditorSession,
  type EditTarget,
  type SaveResult,
} from "@/lib/editor-session";
import { useLatestTask } from "@/lib/hooks/use-latest-task";
import { useSkinLibrary } from "@/lib/hooks/use-skin-library";
import { runHttpEffect } from "@/lib/effect-http";
import type { SkinVariant } from "@/lib/skin";
import { checkSkin, repairSkin, type SkinIssueId } from "@/lib/skin-check";
import {
  createTemplate,
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "@/lib/skin-document";
import { browserStorage, discardDraft, writeHandoff } from "@/lib/skin-draft";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import {
  browserLibrary,
  withLibrary,
  type LibraryClient,
} from "@/lib/skin-library-client";
import {
  isEditableContent,
  prepareSkinContent,
  type SkinSource,
  type StoredSkin,
} from "@/lib/skin-library";
import {
  allPartsVisible,
  type PaintSettings,
  type PaintTool,
  type Rgba,
} from "@/lib/skin-paint";
import { SKIN_SIZE, type SkinLayer } from "@/lib/skin-regions";
import { loadTextureEffect } from "@/lib/skin-texture";

function errorMessage(cause: unknown) {
  if (cause && typeof cause === "object" && "message" in cause)
    return String(cause.message);
  return "Something went wrong.";
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** Create the pixel store and its library session for one editor. */
export function useEditorSession(initial: SkinDocument, target: EditTarget) {
  const [editor] = useState(() => {
    const store = new SkinEditorStore();
    const session = new EditorSession(store, browserLibrary());
    session.start(initial, target);
    return { store, session };
  });
  useEffect(() => () => editor.session.dispose(), [editor]);
  return editor;
}

/** Keep a newly opened PNG in the library, so edits can be saved to it. */
async function keepOpened(
  library: LibraryClient | undefined,
  png: Blob,
  name: string,
  source: SkinSource,
): Promise<EditTarget> {
  if (!library) return { name };
  try {
    const { skin } = await library.run(
      Effect.gen(function* () {
        const content = yield* prepareSkinContent(png);
        return yield* withLibrary((l) =>
          l.add({ name, content, source }, { dedupe: true }),
        );
      }),
    );
    return { skinId: skin.id, baseRevision: skin.revision, name: skin.name };
  } catch {
    return { name };
  }
}

type Confirm =
  | { readonly kind: "changed" | "removed" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "discard"; readonly after?: () => void }
  | { readonly kind: "replace"; readonly open: () => void };

/** The editor page. */
export function SkinEditor({ texture }: { texture?: string }) {
  const { store, session } = useEditorSession(createTemplate("classic"), {
    name: "New skin",
  });
  return (
    <SkinEditorWorkspace
      mode="page"
      store={store}
      session={session}
      texture={texture}
    />
  );
}

export function SkinEditorWorkspace(props: {
  mode: "page" | "dialog";
  store: SkinEditorStore;
  session: EditorSession;
  texture?: string;
  /** Dialog mode: the skin was saved or saved as a copy. */
  onSaved?: (result: Extract<SaveResult, { kind: "saved" }>) => void;
  /** Dialog mode: close the editor. */
  onClose?: () => void;
}) {
  const { store, session, mode, texture } = props;
  const navigate = useNavigate();
  const library = useSkinLibrary();
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const work = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [tool, setTool] = useState<PaintTool>("pencil");
  const [layer, setLayer] = useState<SkinLayer>("base");
  const [color, setColor] = useState<Rgba>([76, 118, 160, 255]);
  const [recent, setRecent] = useState<Rgba[]>([]);
  const [visibility, setVisibility] = useState(allPartsVisible);
  const [interaction, setInteraction] = useState<EditorInteraction>("paint");
  const [view, setView] = useState<"texture" | "model">("texture");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(8);
  const [showGrid, setShowGrid] = useState(true);
  const [highlight, setHighlight] = useState<SkinIssueId | null>(null);
  const [status, setStatus] = useState("");
  const [textureLoading, setTextureLoading] = useState(false);
  const [textureError, setTextureError] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [legacyDraftHidden, setLegacyDraftHidden] = useState(false);
  const textureTask = useLatestTask();
  const textureFrame = useRef<HTMLDivElement>(null);
  const draftsOff = work.drafts.kind === "off";

  const settings = useMemo<PaintSettings>(
    () => ({ layer, color, visibility }),
    [layer, color, visibility],
  );
  const scale = zoom === "fit" ? fitScale : zoom;
  const issues = checkSkin(store.pixels, snapshot.variant);
  const highlightedPixels = issues.find((i) => i.id === highlight)?.pixels;

  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showStatus = useCallback((message: string) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(""), 6000);
  }, []);
  useEffect(() => () => clearTimeout(statusTimer.current), []);

  // Drafts survive a closed tab. Without drafts, the browser asks first.
  useEffect(() => {
    const flush = () => void session.flush();
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [session]);
  const unsafeToLeave = work.dirty && draftsOff;
  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      next.pathname !== current.pathname &&
      !window.confirm(
        "Leave without saving? Drafts are off, so your changes will be lost.",
      ),
    enableBeforeUnload: () => unsafeToLeave,
    disabled: !unsafeToLeave,
  });

  // Offer earlier unsaved work. Each draft belongs to one editor session.
  const initialTarget = useRef(work.target);
  useEffect(() => {
    if (!mounted) return;
    void session.loadRecovery(
      mode === "dialog" ? { skinId: initialTarget.current.skinId } : undefined,
    );
  }, [mounted, mode, session]);

  /** Switch to another skin. The current work stays as a draft. */
  const opened = useCallback(
    (
      document: SkinDocument,
      target: EditTarget,
      source: "file" | "template" | "texture_url" | "draft" | "library",
    ) => {
      textureTask.cancel();
      setTextureLoading(false);
      setTextureError(null);
      const open = () => {
        void session.flush();
        session.start(document, target);
        setHighlight(null);
        posthog.capture("editor_opened", { source });
      };
      if (
        session.getSnapshot().dirty &&
        session.getSnapshot().drafts.kind === "off"
      )
        setConfirm({ kind: "replace", open });
      else open();
    },
    [session, textureTask],
  );

  const openTexture = useCallback(
    (reference: string) => {
      setTextureLoading(true);
      setTextureError(null);
      const client = library.client ?? browserLibrary();
      void textureTask.run(
        async (signal) => {
          const result = await runHttpEffect(
            loadTextureEffect(reference),
            signal,
          );
          const target = await keepOpened(
            client,
            new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
              type: "image/png",
            }),
            `Texture ${result.hash.slice(0, 8)}`,
            { kind: "texture", textureHash: result.hash },
          );
          return { result, target };
        },
        ({ result, target }) => {
          setTextureLoading(false);
          opened(result.document, target, "texture_url");
        },
        (cause) => {
          setTextureLoading(false);
          setTextureError(errorMessage(cause));
        },
      );
    },
    [opened, textureTask, library.client],
  );

  useEffect(() => {
    if (texture && mode === "page") openTexture(texture);
  }, [texture, mode, openTexture]);

  const openFile = useCallback(
    (file: File) => {
      setTextureLoading(false);
      setTextureError(null);
      const client = library.client ?? browserLibrary();
      return textureTask.run(
        async () => {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const imported = await importSkinPng(bytes);
          const target = await keepOpened(
            client,
            new Blob([bytes], { type: "image/png" }),
            file.name,
            { kind: "file" },
          );
          return { imported, target };
        },
        ({ imported, target }) => opened(imported.document, target, "file"),
        (cause) => toast.error(errorMessage(cause)),
      );
    },
    [opened, textureTask, library.client],
  );

  const openSaved = useCallback(
    (skin: StoredSkin) => {
      if (!isEditableContent(skin.current)) {
        toast.error("The editor opens only 64×64 and 64×32 skins.");
        return;
      }
      void textureTask.run(
        () => documentOf(skin.current.png, skin.current.variant),
        (document) =>
          opened(
            document,
            { skinId: skin.id, baseRevision: skin.revision, name: skin.name },
            "library",
          ),
        (cause) => toast.error(errorMessage(cause)),
      );
    },
    [opened, textureTask],
  );

  const onPainted = useCallback(() => {
    setStatus("");
    if (tool === "eraser" || tool === "eyedropper") return;
    const used: Rgba =
      layer === "base" ? [color[0], color[1], color[2], 255] : color;
    setRecent((list) =>
      [used, ...list.filter((c) => c.some((v, i) => v !== used[i]))].slice(
        0,
        10,
      ),
    );
  }, [tool, layer, color]);

  const onPick = useCallback(
    (picked: Rgba) => {
      if (picked[3] === 0) {
        showStatus("That pixel is clear.");
        return;
      }
      setColor(picked);
      setTool("pencil");
      showStatus(`Picked ${toHex(picked)}.`);
    },
    [showStatus],
  );

  const changeLayer = useCallback(
    (next: SkinLayer) => {
      setLayer(next);
      if (next === "base" && tool === "eraser") setTool("pencil");
    },
    [tool],
  );

  // Keyboard shortcuts work everywhere on the page except in text fields.
  const shortcuts = useAsRef({ layer, changeLayer });
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey) {
        if (event.altKey) return;
        if (key === "z" && !event.shiftKey) store.undo();
        else if ((key === "z" && event.shiftKey) || key === "y") store.redo();
        else return;
        event.preventDefault();
        return;
      }
      if (event.altKey) return;
      const tools: Record<string, PaintTool> = {
        b: "pencil",
        e: "eraser",
        g: "fill",
        i: "eyedropper",
      };
      if (tools[key]) setTool(tools[key]);
      else if (key === "l")
        shortcuts.current.changeLayer(
          shortcuts.current.layer === "base" ? "outer" : "base",
        );
      else if (key === "p") setInteraction("paint");
      else if (key === "m") setInteraction("move");
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [store, shortcuts]);

  useEffect(() => {
    const frame = textureFrame.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      const width = frame.clientWidth;
      if (width > 0)
        setFitScale(Math.max(3, Math.min(16, Math.floor(width / SKIN_SIZE))));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const download = async () => {
    try {
      const bytes = await exportSkinPng(store.pixels);
      const url = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${work.target.name}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      posthog.capture("editor_exported_png");
    } catch (cause) {
      toast.error(`The PNG could not be made: ${errorMessage(cause)}`);
    }
  };

  const handOff = async (target: "upload" | "generator") => {
    setHandingOff(true);
    try {
      await session.flush();
      const handoff = await writeHandoff(
        browserStorage("sessionStorage"),
        store.document(),
      );
      posthog.capture("editor_handoff", { target });
      await navigate({ to: `/${target}`, search: { handoff } });
    } catch (cause) {
      toast.error(errorMessage(cause));
    } finally {
      setHandingOff(false);
    }
  };

  const handle = (result: SaveResult, kind: "save" | "copy") => {
    if (result.kind === "saved") {
      posthog.capture("editor_saved", { kind, kept: !!result.skin });
      if (mode === "dialog") {
        props.onSaved?.(result);
        props.onClose?.();
        return;
      }
      if (kind === "copy") toast.success("Saved as a copy.");
      return;
    }
    setConfirm(
      result.kind === "failed"
        ? { kind: "failed", message: result.message }
        : { kind: result.kind },
    );
  };
  const save = async (replace = false) => {
    // Nothing changed: keep the form's exact file.
    if (mode === "dialog" && !work.dirty) {
      props.onClose?.();
      return;
    }
    handle(await session.save({ replace }), "save");
  };
  const saveCopy = async () => handle(await session.saveCopy(), "copy");
  const discard = () =>
    setConfirm({
      kind: "discard",
      after: mode === "dialog" ? props.onClose : undefined,
    });

  const zoomBy = (step: number) =>
    setZoom(Math.max(3, Math.min(24, scale + step)));

  const [saveState, saveLabel]: [SaveState, string] = work.busy
    ? ["saving", "Saving"]
    : work.dirty
      ? [
          "unsaved",
          draftsOff ? "Unsaved changes" : "Unsaved changes, draft kept",
        ]
      : work.target.skinId
        ? ["saved", "Saved"]
        : draftsOff
          ? ["unavailable", "Cannot be kept in this browser"]
          : ["unsaved", "Not saved yet"];

  const migratedStatus = library.migrated?.status;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {mounted &&
          migratedStatus === "corrupt" &&
          !legacyDraftHidden &&
          mode === "page" && (
            <Alert variant="destructive">
              <AlertTitle>The old draft could not be read</AlertTitle>
              <AlertAction>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    discardDraft(browserStorage("localStorage"));
                    setLegacyDraftHidden(true);
                  }}
                >
                  Discard draft
                </Button>
              </AlertAction>
            </Alert>
          )}
        {mounted && migratedStatus === "newer" && mode === "page" && (
          <Alert>
            <AlertTitle>A newer draft is waiting</AlertTitle>
            <AlertDescription>Reload the page to open it.</AlertDescription>
          </Alert>
        )}
        {work.recovery.length > 0 && (
          <div className="ph-no-capture">
            <Alert>
              <AlertTitle>Continue unsaved changes?</AlertTitle>
              <AlertDescription>
                <ul className="flex flex-col gap-2">
                  {work.recovery.map((draft) => (
                    <li
                      key={draft.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>
                        {draft.name}, changed{" "}
                        <CustomTimeAgo date={draft.updatedAt} />
                      </span>
                      <span className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void session
                              .continueDraft(draft)
                              .then(() =>
                                posthog.capture("editor_opened", {
                                  source: "draft",
                                }),
                              )
                              .catch((cause) =>
                                toast.error(errorMessage(cause)),
                              )
                          }
                        >
                          Continue
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void session.discardDraft(draft.id)}
                        >
                          Discard
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        )}
        {mounted && draftsOff && (
          <Alert>
            <AlertTitle>Drafts are off</AlertTitle>
            <AlertDescription>
              Download the PNG to keep your work.
            </AlertDescription>
          </Alert>
        )}

        <section
          aria-label="Skin being edited"
          className="ph-no-capture flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium">{work.target.name}</p>
            {mounted && <SaveStatus state={saveState} label={saveLabel} />}
          </div>
          <div className="flex flex-wrap gap-2">
            {(work.dirty || mode === "dialog") && (
              <Button variant="ghost" disabled={work.busy} onClick={discard}>
                Discard
              </Button>
            )}
            <Button
              variant="outline"
              disabled={work.busy}
              onClick={() => void saveCopy()}
            >
              <Copy data-icon="inline-start" />
              Save as copy
            </Button>
            <Button
              disabled={
                work.busy ||
                (mode === "page" && !work.dirty && !!work.target.skinId)
              }
              onClick={() => void save()}
            >
              <Save data-icon="inline-start" />
              Save changes
            </Button>
          </div>
        </section>

        <div className="ph-no-capture grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section
            aria-label="Workspace"
            className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20"
          >
            <div className="sticky bottom-2 order-last flex flex-col gap-2 rounded-lg border bg-background p-2 shadow-sm lg:static lg:order-first lg:border-0 lg:p-0 lg:shadow-none">
              <EditorToolbar
                tool={tool}
                layer={layer}
                interaction={interaction}
                canUndo={snapshot.canUndo}
                canRedo={snapshot.canRedo}
                onTool={setTool}
                onInteraction={setInteraction}
                onUndo={() => store.undo()}
                onRedo={() => store.redo()}
              />
              <output
                className={status ? "text-sm text-muted-foreground" : "sr-only"}
                aria-live="polite"
              >
                {status}
              </output>
            </div>
            <ToggleGroup
              aria-label="View"
              variant="outline"
              spacing={0}
              className="w-full lg:hidden"
              value={[view]}
              onValueChange={(value) => {
                if (value[0]) setView(value[0] as "texture" | "model");
              }}
            >
              <ToggleGroupItem value="texture" className="flex-1">
                Texture
              </ToggleGroupItem>
              <ToggleGroupItem value="model" className="flex-1">
                3D model
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card
                className={
                  view === "texture" ? "min-w-0" : "hidden min-w-0 lg:flex"
                }
              >
                <CardHeader>
                  <CardTitle>Texture</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Zoom texture out"
                      onClick={() => zoomBy(-2)}
                    >
                      <ZoomOut />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Zoom texture in"
                      onClick={() => zoomBy(2)}
                    >
                      <ZoomIn />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-pressed={zoom === "fit"}
                      onClick={() => setZoom("fit")}
                    >
                      <Maximize data-icon="inline-start" />
                      Fit
                    </Button>
                    <Toggle
                      variant="outline"
                      size="sm"
                      pressed={showGrid}
                      onPressedChange={setShowGrid}
                    >
                      <Grid3x3 />
                      Pixel grid
                    </Toggle>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {scale}× zoom
                    </span>
                  </div>
                  <div
                    ref={textureFrame}
                    className="max-h-[75dvh] overflow-auto"
                  >
                    <TextureCanvas
                      store={store}
                      tool={tool}
                      settings={settings}
                      interaction={interaction}
                      scale={scale}
                      showGrid={showGrid}
                      highlight={highlightedPixels}
                      onPick={onPick}
                      onPainted={onPainted}
                      onStatus={showStatus}
                    />
                  </div>
                </CardContent>
              </Card>
              <Card
                className={
                  view === "model" ? "min-w-0" : "hidden min-w-0 lg:flex"
                }
              >
                <CardHeader>
                  <CardTitle>3D model</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ModelCanvas
                    store={store}
                    tool={tool}
                    settings={settings}
                    interaction={interaction}
                    onPick={onPick}
                    onPainted={onPainted}
                    onStatus={showStatus}
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <aside aria-label="Skin settings" className="flex flex-col gap-6">
            <SkinIssueAlerts
              issues={issues}
              highlighted={highlight}
              onHighlight={setHighlight}
              onRepair={(id) => {
                store.apply((pixels, builder) =>
                  repairSkin(id, pixels, store.getSnapshot().variant, builder),
                );
                setHighlight(null);
                posthog.capture("editor_check_fix_applied", { issue: id });
              }}
              onVariant={(variant) => store.setVariant(variant)}
            />
            {mode === "page" && (
              <OpenSkinPanel
                textureLoading={textureLoading}
                textureError={textureError}
                library={library}
                currentSkinId={work.target.skinId}
                onFile={(file) => void openFile(file)}
                onSaved={openSaved}
                onTemplate={(variant) =>
                  opened(
                    createTemplate(variant),
                    { name: "New skin" },
                    "template",
                  )
                }
                onTexture={openTexture}
              />
            )}
            <ColorPanel
              color={color}
              layer={layer}
              recent={recent}
              onChange={setColor}
            />
            <LayersPanel
              layer={layer}
              variant={snapshot.variant}
              visibility={visibility}
              onLayerChange={changeLayer}
              onVariantChange={(variant: SkinVariant) =>
                store.setVariant(variant)
              }
              onVisibilityChange={setVisibility}
            />
            <Card>
              <CardHeader>
                <CardTitle>Finish</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button
                  variant={mode === "page" ? "default" : "outline"}
                  onClick={() => void download()}
                >
                  <Download data-icon="inline-start" />
                  Download PNG
                </Button>
                {mode === "page" && (
                  <>
                    <Button
                      variant="outline"
                      disabled={handingOff}
                      onClick={() => void handOff("upload")}
                    >
                      <Upload data-icon="inline-start" />
                      Use in Upload
                    </Button>
                    <Button
                      variant="outline"
                      disabled={handingOff}
                      onClick={() => void handOff("generator")}
                    >
                      <Wand2 data-icon="inline-start" />
                      Use in Generator
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          {confirm && (
            <ConfirmBody
              confirm={confirm}
              mode={mode}
              onCopy={() => {
                setConfirm(null);
                void saveCopy();
              }}
              onReplace={() => {
                setConfirm(null);
                void save(true);
              }}
              onUnkept={async () => {
                setConfirm(null);
                handle(await session.save({ keep: false }), "save");
              }}
              onDiscard={async () => {
                const after =
                  confirm.kind === "discard" ? confirm.after : undefined;
                setConfirm(null);
                await session.discard();
                after?.();
              }}
              onOpen={() => {
                if (confirm.kind === "replace") confirm.open();
                setConfirm(null);
              }}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}

function ConfirmBody(props: {
  confirm: Confirm;
  mode: "page" | "dialog";
  onCopy: () => void;
  onReplace: () => void;
  onUnkept: () => void;
  onDiscard: () => void;
  onOpen: () => void;
}) {
  const { confirm } = props;
  const text = {
    changed: [
      "This skin changed in another tab",
      "Save yours as a copy, or replace the other version.",
    ],
    removed: ["This skin was removed", "Save your work as a copy to keep it."],
    failed: [
      "The skin could not be saved",
      confirm.kind === "failed"
        ? `${confirm.message} ${props.mode === "dialog" ? "You can still use it without saving." : "Download the PNG to keep your work."}`
        : "",
    ],
    discard: ["Discard unsaved changes?", "The saved skin stays as it was."],
    replace: [
      "Open another skin?",
      "Drafts are off, so your unsaved changes will be lost.",
    ],
  }[confirm.kind];
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{text[0]}</AlertDialogTitle>
        <AlertDialogDescription>{text[1]}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        {confirm.kind === "changed" && (
          <Button variant="outline" onClick={props.onReplace}>
            Replace it
          </Button>
        )}
        {(confirm.kind === "changed" || confirm.kind === "removed") && (
          <Button onClick={props.onCopy}>Save as copy</Button>
        )}
        {confirm.kind === "failed" && props.mode === "dialog" && (
          <Button onClick={props.onUnkept}>Use without saving</Button>
        )}
        {confirm.kind === "discard" && (
          <Button variant="destructive" onClick={props.onDiscard}>
            Discard changes
          </Button>
        )}
        {confirm.kind === "replace" && (
          <Button variant="destructive" onClick={props.onOpen}>
            Open and lose changes
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}
