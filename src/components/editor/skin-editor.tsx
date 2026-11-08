"use client";

import { useNavigate } from "@tanstack/react-router";
import {
  Download,
  Grid3x3,
  Maximize,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorPanel, toHex } from "@/components/editor/color-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import type { EditorInteraction } from "@/components/editor/editor-types";
import { LayersPanel } from "@/components/editor/layers-panel";
import { ModelCanvas } from "@/components/editor/model-canvas";
import { OpenSkinPanel } from "@/components/editor/open-skin-panel";
import { SkinCheckPanel } from "@/components/editor/skin-check-panel";
import { TextureCanvas } from "@/components/editor/texture-canvas";
import { useLatestTask } from "@/lib/hooks/use-latest-task";
import { runHttpEffect } from "@/lib/effect-http";
import type { SkinVariant } from "@/lib/skin";
import { checkSkin, repairSkin, type SkinIssueId } from "@/lib/skin-check";
import {
  createTemplate,
  exportSkinPng,
  importSkinPng,
  type SkinDocument,
} from "@/lib/skin-document";
import {
  browserStorage,
  discardDraft,
  readDraft,
  saveDraft,
  writeHandoff,
  type KeyValueStorage,
} from "@/lib/skin-draft";
import { SkinEditorStore } from "@/lib/skin-editor-store";
import {
  allPartsVisible,
  type PaintSettings,
  type PaintTool,
  type Rgba,
} from "@/lib/skin-paint";
import { SKIN_SIZE, type SkinLayer } from "@/lib/skin-regions";
import { loadTextureEffect } from "@/lib/skin-texture";

type DraftState =
  | {
      readonly kind:
        | "checking"
        | "saving"
        | "corrupt"
        | "newer"
        | "unavailable"
        | "full";
    }
  | {
      readonly kind: "offer";
      readonly document: SkinDocument;
      readonly updatedAt: number;
    };

const SAVE_DELAY_MS = 500;

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

export function SkinEditor({ texture }: { texture?: string }) {
  const navigate = useNavigate();
  const [store] = useState(() => {
    const editor = new SkinEditorStore();
    editor.load(createTemplate("classic"));
    return editor;
  });
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
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
  const [legacy, setLegacy] = useState(false);
  const [highlight, setHighlight] = useState<SkinIssueId | null>(null);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<DraftState>({ kind: "checking" });
  const [textureLoading, setTextureLoading] = useState(false);
  const [textureError, setTextureError] = useState<string | null>(null);
  const [handingOff, setHandingOff] = useState(false);
  const textureTask = useLatestTask();
  const storage = useRef<KeyValueStorage | undefined>(undefined);
  const textureFrame = useRef<HTMLDivElement>(null);

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

  // Drafts: one saved skin in this browser. Saving waits until the user has
  // answered a restore offer, so an old draft is never overwritten unasked.
  const draftRef = useAsRef(draft);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savePending = useRef(false);
  const saveNow = useCallback(() => {
    clearTimeout(saveTimer.current);
    if (!savePending.current) return;
    const kind = draftRef.current.kind;
    if (kind !== "saving" && kind !== "full") return;
    savePending.current = false;
    const result = saveDraft(storage.current, store.document());
    if (result === "saved" && kind === "full") setDraft({ kind: "saving" });
    else if (result !== "saved") setDraft({ kind: result });
  }, [draftRef, store]);

  useEffect(() => {
    let revision = store.getSnapshot().revision;
    return store.subscribe(() => {
      const next = store.getSnapshot();
      if (next.revision !== revision) {
        revision = next.revision;
        savePending.current = true;
      }
      clearTimeout(saveTimer.current);
      if (savePending.current && !next.painting)
        saveTimer.current = setTimeout(saveNow, SAVE_DELAY_MS);
    });
  }, [store, saveNow]);

  useEffect(() => {
    const flush = () => saveNow();
    const hidden = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", hidden);
      saveNow();
    };
  }, [saveNow]);

  useEffect(() => {
    storage.current = browserStorage("localStorage");
    let active = true;
    void readDraft(storage.current).then((result) => {
      if (!active) return;
      if (result.status === "found")
        setDraft({
          kind: "offer",
          document: result.document,
          updatedAt: result.updatedAt,
        });
      else if (result.status === "none") setDraft({ kind: "saving" });
      else setDraft({ kind: result.status });
    });
    return () => {
      active = false;
    };
  }, []);

  // Changes made before the draft check finished are saved once it allows.
  useEffect(() => {
    if (draft.kind === "saving") saveNow();
  }, [draft.kind, saveNow]);

  const opened = useCallback(
    (
      document: SkinDocument,
      source: "file" | "template" | "texture_url" | "draft",
      wasLegacy = false,
    ) => {
      // A template or restored draft also supersedes any pending import.
      textureTask.cancel();
      setTextureLoading(false);
      setTextureError(null);
      store.replace(document);
      setLegacy(wasLegacy);
      setHighlight(null);
      posthog.capture("editor_opened", { source });
    },
    [store, textureTask],
  );

  const openTexture = useCallback(
    (reference: string) => {
      setTextureLoading(true);
      setTextureError(null);
      void textureTask.run(
        (signal) => runHttpEffect(loadTextureEffect(reference), signal),
        (result) => {
          setTextureLoading(false);
          opened(result.document, "texture_url", result.legacy);
          toast.success("Opened the texture from textures.minecraft.net.");
        },
        (cause) => {
          setTextureLoading(false);
          setTextureError(errorMessage(cause));
        },
      );
    },
    [opened, textureTask],
  );

  useEffect(() => {
    if (texture) openTexture(texture);
  }, [texture, openTexture]);

  const openFile = useCallback(
    (file: File) => {
      setTextureLoading(false);
      setTextureError(null);
      return textureTask.run(
        async () => importSkinPng(new Uint8Array(await file.arrayBuffer())),
        (imported) => {
          opened(imported.document, "file", imported.legacy);
          toast.success(
            imported.legacy
              ? "Opened the skin and converted it from 64×32 to 64×64."
              : "Opened the skin.",
          );
        },
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
        showStatus("That pixel is fully clear. Pick a visible pixel.");
        return;
      }
      setColor(picked);
      setTool("pencil");
      showStatus(`Picked ${toHex(picked)}. Switched to the pencil.`);
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
      link.download = "skin.png";
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
      savePending.current = true;
      saveNow();
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

  const zoomBy = (step: number) =>
    setZoom(Math.max(3, Math.min(24, scale + step)));

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {draft.kind === "offer" && (
          <Alert>
            <AlertTitle>Restore your last skin?</AlertTitle>
            <AlertDescription>
              This browser has a draft from{" "}
              {new Date(draft.updatedAt).toLocaleString()}. New changes are not
              saved until you choose.
            </AlertDescription>
            <AlertAction>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    opened(draft.document, "draft");
                    setDraft({ kind: "saving" });
                  }}
                >
                  Restore draft
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    discardDraft(storage.current);
                    setDraft({ kind: "saving" });
                  }}
                >
                  Discard
                </Button>
              </div>
            </AlertAction>
          </Alert>
        )}
        {draft.kind === "corrupt" && (
          <Alert variant="destructive">
            <AlertTitle>The saved draft could not be read</AlertTitle>
            <AlertDescription>
              Drafts are paused so the damaged draft is kept until you remove
              it.
            </AlertDescription>
            <AlertAction>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  discardDraft(storage.current);
                  setDraft({ kind: "saving" });
                }}
              >
                Discard draft
              </Button>
            </AlertAction>
          </Alert>
        )}
        {(draft.kind === "unavailable" ||
          draft.kind === "full" ||
          draft.kind === "newer") && (
          <Alert>
            <AlertTitle>Drafts are off</AlertTitle>
            <AlertDescription>
              {draft.kind === "unavailable"
                ? "This browser blocks site storage, so the editor cannot keep a draft. Everything else works. Download the PNG to keep your work."
                : draft.kind === "full"
                  ? "Browser storage is full, so the latest changes are not saved as a draft. Download the PNG to keep your work."
                  : "A newer version of the editor saved the draft in this browser. Reload the page to open it. This page does not replace it."}
            </AlertDescription>
          </Alert>
        )}

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
                className="min-h-5 text-sm text-muted-foreground"
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
                  <CardDescription>
                    Outlines mark each face of the {layer} layer. Faded areas
                    are not changed by tools.
                  </CardDescription>
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
                  <CardDescription>
                    Paint on the model or turn it to check your work.
                  </CardDescription>
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
                    onUnavailable={showStatus}
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <aside aria-label="Skin settings" className="flex flex-col gap-6">
            <OpenSkinPanel
              textureLoading={textureLoading}
              textureError={textureError}
              onFile={(file) => void openFile(file)}
              onTemplate={(variant) =>
                opened(createTemplate(variant), "template")
              }
              onTexture={openTexture}
            />
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
            <SkinCheckPanel
              issues={issues}
              legacy={legacy}
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
            <Card>
              <CardHeader>
                <CardTitle>Finish</CardTitle>
                <CardDescription>
                  Download the skin, or send it to a SkinsRestorer tool to get a
                  command.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Button onClick={() => void download()}>
                  <Download data-icon="inline-start" />
                  Download PNG
                </Button>
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
                <p className="text-xs text-muted-foreground">
                  Upload and Generator open with this skin and its{" "}
                  {snapshot.variant} model selected. They send nothing until you
                  press their button.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
