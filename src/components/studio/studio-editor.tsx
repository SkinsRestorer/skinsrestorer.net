"use client";

import type { Message, MessageKey } from "@/lib/messages";

import { useHotkeys, type UseHotkeyDefinition } from "@tanstack/react-hotkeys";
import { useBlocker } from "@tanstack/react-router";
import {
  Download,
  Grid3x3,
  Maximize,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { analytics } from "@/lib/analytics";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { useAsRef } from "@/hooks/use-as-ref";
import {
  editorShortcuts,
  toolCommands,
  type EditorCommand,
} from "@/components/editor/editor-shortcuts";
import { ColorControls } from "@/components/editor/color-panel";
import { toHex } from "@/components/editor/color-hex";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import {
  toolLabels,
  usesMirror,
  type EditorInteraction,
} from "@/components/editor/editor-types";
import { LayerToggle, VisibleParts } from "@/components/editor/layers-panel";
import { ModelCanvas } from "@/components/editor/model-canvas";
import { PartActions } from "@/components/editor/part-actions";
import { SkinIssueAlerts } from "@/components/editor/skin-issue-alerts";
import { TextureCanvas } from "@/components/editor/texture-canvas";
import { ToolOptions } from "@/components/editor/tool-options";
import { ModelSelector } from "@/components/model-selector";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EditorSession, SaveResult } from "@/lib/editor-session";
import { checkSkin, repairSkin, type SkinIssueId } from "@/lib/skin-check";
import { exportSkinPng } from "@/lib/skin-document";
import type { SkinEditorStore } from "@/lib/skin-editor-store";
import {
  allPartsVisible,
  BRUSH_SIZES,
  defaultBrush,
  type FillScope,
  type PaintSettings,
  type PaintTool,
  type Rgba,
  type ShadeMode,
  type ShadeStrength,
} from "@/lib/skin-paint";
import type { PartAction } from "@/lib/skin-transform";
import { SKIN_SIZE, type SkinLayer } from "@/lib/skin-regions";
import { useT } from "@/lib/i18n-react";
import { downloadSkin } from "@/lib/hooks/use-skin-library";
import { useRecentColors } from "@/lib/hooks/use-recent-colors";
import { cn } from "@/lib/utils";

/** An open menu, list, or dialog handles Escape before the editor does. */
function popupOpen() {
  return !!document.querySelector(
    "[role=menu],[role=listbox],[role=dialog],[role=alertdialog]",
  );
}

/** Texture zoom limits, in CSS pixels for each skin pixel. */
const MIN_ZOOM = 3;
const MAX_ZOOM = 24;

type Confirm =
  | { readonly kind: "changed" | "removed" | "leave" }
  | { readonly kind: "failed" | "draftFailed"; readonly message: Message };

// Shortcuts work on the whole page, including popups, but not while the
// user types in a field or another control already handled the key.
const run = (command: EditorCommand, action: () => void, repeat = false) =>
  editorShortcuts[command].map((hotkey): UseHotkeyDefinition => ({
    hotkey,
    callback: action,
    // Toggles need a new key press; holding a size or undo key repeats.
    options: { requireReset: !repeat },
  }));

/**
 * Edit mode of the Studio. It fills the center and options columns while the
 * library stays visible but inert. The store keeps the skin as RGBA pixels;
 * the PNG codec runs only for drafts, saves, and downloads.
 */
export function StudioEditor(props: {
  store: SkinEditorStore;
  session: EditorSession;
  /** A new skin from Create skin, saved to the library on Save. */
  isNew: boolean;
  onSaved: (result: Extract<SaveResult, { kind: "saved" }>) => void;
  /** Return to the view. The selection is the one from before editing. */
  onExit: () => void;
}) {
  const t = useT();
  const { store, session, onExit } = props;
  const exitHandler = useAsRef(onExit);
  // The canvases follow each stroke sample themselves. The editor and its
  // skin check update when a stroke starts and ends.
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSettledSnapshot,
    store.getSettledSnapshot,
  );
  const work = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const [tool, setTool] = useState<PaintTool>("pencil");
  const [layer, setLayer] = useState<SkinLayer>("base");
  const [color, setColor] = useState<Rgba>([76, 118, 160, 255]);
  const [recent, addRecent] = useRecentColors();
  const [visibility, setVisibility] = useState(allPartsVisible);
  const [size, setSize] = useState(defaultBrush.size);
  const [mirror, setMirror] = useState(defaultBrush.mirror);
  const [shade, setShade] = useState<ShadeMode>(defaultBrush.shade);
  const [shadeStrength, setShadeStrength] = useState<ShadeStrength>(
    defaultBrush.shadeStrength,
  );
  const [fillScope, setFillScope] = useState<FillScope>(defaultBrush.fillScope);
  const [interaction, setInteraction] = useState<EditorInteraction>("paint");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(5);
  const [showGrid, setShowGrid] = useState(true);
  const [highlight, setHighlight] = useState<SkinIssueId | null>(null);
  const [status, setStatus] = useState<Message>("");
  /** What a shortcut changed, for screen readers. The controls show it. */
  const [shortcutNote, setShortcutNote] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const textureFrame = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  // The control that opened the editor unmounts: start keyboard users here.
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const modelId = useId();
  const exited = useRef(false);
  const draftsOff = work.drafts.kind === "off";

  const settings = useMemo<PaintSettings>(
    () => ({
      layer,
      color,
      visibility,
      size,
      mirror,
      shade,
      shadeStrength,
      fillScope,
    }),
    [layer, color, visibility, size, mirror, shade, shadeStrength, fillScope],
  );

  // A straight line continues the last stroke of the same tool and layer.
  useEffect(() => {
    store.resetLineAnchor();
  }, [store, tool, layer]);
  const scale = zoom === "fit" ? fitScale : zoom;
  // The check reads every pixel, so it runs once for each pixel or model
  // change. A stable result also keeps the texture from redrawing when only
  // other editor state changes.
  const issues = useMemo(
    () => checkSkin(store.pixels, snapshot.variant),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `revision` marks pixel changes in the mutable `store.pixels`.
    [store, snapshot.revision, snapshot.variant],
  );
  const highlightedPixels = useMemo(
    () => issues.find((i) => i.id === highlight)?.pixels,
    [issues, highlight],
  );

  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showStatus = useCallback((message: Message) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => {
      setStatus("");
    }, 6000);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(statusTimer.current);
    },
    [],
  );

  const exit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    exitHandler.current();
  }, [exitHandler]);

  /** Cancel, Esc, and Back ask first when there are unsaved changes. */
  const requestExit = useCallback(() => {
    if (session.getSnapshot().dirty) setConfirm({ kind: "leave" });
    else exit();
  }, [session, exit]);

  // Drafts survive a closed tab. The browser may stop the page right after
  // these events, so the draft write starts before the handler returns.
  useEffect(() => {
    const flush = () => void session.flushNow();
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

  // Back, links, and URL changes ask first while there are unsaved changes.
  // The Studio's own navigations that keep the work skip this blocker.
  const shouldBlock = useCallback(
    () => !exited.current && session.getSnapshot().dirty,
    [session],
  );
  // Until a draft of this work exists, closing the tab could lose it, so
  // the browser asks.
  const unsafeToClose = useCallback(() => {
    const state = session.getSnapshot();
    return state.dirty && state.drafts.kind !== "saved";
  }, [session]);
  const navigation = useBlocker({
    shouldBlockFn: shouldBlock,
    enableBeforeUnload: unsafeToClose,
    withResolver: true,
  });
  const blocked = navigation.status === "blocked";

  const onPainted = useCallback(() => {
    setStatus("");
    if (tool !== "pencil" && tool !== "fill") return;
    const used: Rgba =
      layer === "base" ? [color[0], color[1], color[2], 255] : color;
    addRecent(used);
  }, [tool, layer, color, addRecent]);

  const onPick = useCallback(
    (picked: Rgba) => {
      if (picked[3] === 0) {
        showStatus(t("studio.pixelClear"));
        return;
      }
      setColor(picked);
      // Alt picks with any tool and keeps it; the pick tool hands over to
      // the pencil.
      if (tool === "eyedropper") setTool("pencil");
      showStatus(t("studio.pickedColor", { color: toHex(picked) }));
    },
    [tool, showStatus, t],
  );

  const changeLayer = useCallback(
    (next: SkinLayer) => {
      setLayer(next);
      if (next === "base" && tool === "eraser") setTool("pencil");
    },
    [tool],
  );

  // The base layer is always opaque, so the eraser works on the outer layer.
  const changeTool = useCallback(
    (next: PaintTool) => {
      setTool(next);
      if (next === "eraser" && layer === "base") {
        setLayer("outer");
        showStatus(t("studio.eraserSwitchedOuterLayer"));
      }
    },
    [layer, showStatus, t],
  );
  const announce = (setting: MessageKey, value: string) => {
    setShortcutNote(t("editor.settingValue", { setting: t(setting), value }));
  };
  const resize = (step: number) => {
    const next = Math.max(
      BRUSH_SIZES.min,
      Math.min(BRUSH_SIZES.max, size + step),
    );
    setSize(next);
    announce("editor.size", t("editor.sizePx", { size: next }));
  };
  const pointerAction = (next: EditorInteraction) => {
    setInteraction(next);
    announce(
      "editor.pointerAction",
      t(next === "paint" ? "editor.paint" : "editor.moveView"),
    );
  };
  useHotkeys(
    [
      // oxlint-disable-next-line react-hooks-js/refs -- Building the hotkey definitions only stores callbacks. The timer ref is accessed on keypress.
      ...toolCommands.flatMap((command) =>
        run(command, () => {
          // S on the active Shade tool switches between lighten and darken,
          // and G on the active Fill tool between face and everywhere.
          if (command === "shade" && tool === "shade") {
            const next = shade === "lighten" ? "darken" : "lighten";
            setShade(next);
            announce(
              "common.shade",
              t(next === "lighten" ? "editor.lighten" : "editor.darken"),
            );
          } else if (command === "fill" && tool === "fill") {
            const next = fillScope === "face" ? "everywhere" : "face";
            setFillScope(next);
            announce(
              "editor.fillArea",
              t(next === "face" ? "editor.face" : "editor.everywhere"),
            );
          } else {
            changeTool(command);
            announce("editor.tool", t(toolLabels[command]));
          }
        }),
      ),
      ...run("mirror", () => {
        // Fill everywhere and the pick tool ignore mirror and hide its toggle.
        if (!usesMirror(tool, fillScope)) return;
        setMirror(!mirror);
        announce("editor.mirror", t(mirror ? "editor.off" : "editor.on"));
      }),
      ...run(
        "smaller",
        () => {
          resize(-1);
        },
        true,
      ),
      ...run(
        "larger",
        () => {
          resize(1);
        },
        true,
      ),
      ...run("layer", () => {
        const next = layer === "base" ? "outer" : "base";
        changeLayer(next);
        announce(
          "editor.activeLayer",
          t(next === "base" ? "common.base" : "common.outer"),
        );
      }),
      ...run("paint", () => {
        pointerAction("paint");
      }),
      ...run("move", () => {
        pointerAction("move");
      }),
      ...run(
        "undo",
        () => {
          store.undo();
        },
        true,
      ),
      ...run(
        "redo",
        () => {
          store.redo();
        },
        true,
      ),
      ...editorShortcuts.close.map((hotkey): UseHotkeyDefinition => ({
        hotkey,
        callback: () => {
          if (!popupOpen()) requestExit();
        },
        options: {
          requireReset: true,
          preventDefault: false,
          stopPropagation: false,
        },
      })),
    ],
    {
      enabled: confirm === null && !blocked,
      ignoreInputs: true,
      ignoreDefaultPrevented: true,
    },
  );

  useEffect((): (() => void) | undefined => {
    const frame = textureFrame.current;
    if (!frame) return undefined;
    const observer = new ResizeObserver(() => {
      const width = frame.clientWidth;
      if (width > 0)
        setFitScale(Math.max(3, Math.min(8, Math.floor(width / SKIN_SIZE))));
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
    };
  }, []);

  const download = async () => {
    try {
      const bytes = await exportSkinPng(store.pixels);
      downloadSkin(new Blob([bytes], { type: "image/png" }), work.target.name);
      void analytics.capture("editor_exported_png");
    } catch (cause) {
      toast.error(
        t("studio.pngCouldNotMadeError", {
          error: t.error(cause),
        }),
      );
    }
  };

  const handle = (result: SaveResult, kind: "save" | "copy") => {
    if (result.kind === "saved") {
      void analytics.capture("editor_saved", { kind, kept: !!result.skin });
      exited.current = true;
      props.onSaved(result);
      return;
    }
    setConfirm(
      result.kind === "failed"
        ? { kind: "failed", message: result.message }
        : { kind: result.kind },
    );
  };
  const save = async (replace = false) => {
    // Nothing changed: keep the exact selected file.
    if (!props.isNew && !work.dirty) {
      exit();
      return;
    }
    handle(await session.save({ replace }), "save");
  };
  const saveCopy = async () => {
    handle(await session.saveCopy(), "copy");
  };
  const saveUnkept = async () => {
    handle(await session.save({ keep: false }), "save");
  };
  const discardAndLeave = async () => {
    await session.discard();
    leave();
  };
  const keepDraftAndLeave = async () => {
    if (await session.flush()) {
      leave();
      return;
    }
    // The draft was not written, for example because storage is full.
    // Stay open so the work is not lost, and offer the PNG instead.
    const { drafts } = session.getSnapshot();
    setConfirm({
      kind: "draftFailed",
      message: drafts.kind === "off" ? drafts.message : "",
    });
  };

  const convertArms = () => {
    const target =
      store.getSnapshot().variant === "classic" ? "slim" : "classic";
    store.convertVariant(target);
    showStatus(
      target === "slim"
        ? t("studio.convertedArmsSlim")
        : t("studio.convertedArmsClassic"),
    );
  };

  const transformPart = (action: PartAction) => {
    if (!store.transformPart(settings, action))
      showStatus(t("studio.nothingChanged"));
    else setStatus("");
  };

  const zoomTo = useCallback((next: number) => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)));
  }, []);
  const zoomBy = (step: number) => {
    zoomTo(scale + step);
  };

  // One confirmation for Cancel, Escape, Back, and links.
  const shown: Confirm | null = confirm ?? (blocked ? { kind: "leave" } : null);
  /** Finish leaving: let a held navigation go on, or close the editor. */
  const leave = () => {
    if (navigation.status === "blocked") {
      exited.current = true;
      navigation.proceed();
    } else exit();
  };

  const [saveState, saveLabel]: [SaveState, string] = work.busy
    ? ["saving", t("studio.saving")]
    : work.dirty
      ? [
          "unsaved",
          work.drafts.kind === "saved"
            ? t("studio.unsavedChangesDraftKept")
            : t("studio.unsavedChanges"),
        ]
      : work.target.skinId
        ? ["saved", t("studio.saved")]
        : draftsOff
          ? ["unavailable", t("studio.cannotKeptBrowser")]
          : ["unsaved", t("studio.notSavedYet")];

  return (
    <TooltipProvider>
      <section
        aria-label={t("studio.skinBeingEdited")}
        className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground ph-no-capture sm:p-4"
      >
        <div className="flex min-h-8 items-center gap-2">
          <h2
            ref={heading}
            tabIndex={-1}
            className="truncate text-base font-semibold outline-none"
          >
            {props.isNew
              ? work.target.name
              : t("studio.editingName", { name: work.target.name })}
          </h2>
          <SaveStatus state={saveState} label={saveLabel} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={t("common.downloadPng")}
            title={t("common.downloadPng")}
            onClick={() => void download()}
          >
            <Download />
          </Button>
        </div>
        {draftsOff && (
          <Alert>
            <AlertTitle>{t("studio.draftsOff")}</AlertTitle>
            <AlertDescription>
              {t("studio.downloadPngKeepWork")}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <EditorToolbar
            tool={tool}
            layer={layer}
            interaction={interaction}
            canUndo={snapshot.canUndo}
            canRedo={snapshot.canRedo}
            onTool={changeTool}
            onInteraction={setInteraction}
            onUndo={() => {
              store.undo();
            }}
            onRedo={() => {
              store.redo();
            }}
          />
          <LayerToggle layer={layer} onLayerChange={changeLayer} />
          <span className="ml-auto flex items-center">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("studio.zoomTextureOut")}
                    disabled={scale <= MIN_ZOOM}
                    focusableWhenDisabled
                    onClick={() => {
                      zoomBy(-2);
                    }}
                  />
                }
              >
                <ZoomOut />
              </TooltipTrigger>
              <TooltipContent>{t("studio.zoomTextureOut")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("studio.zoomTexture")}
                    disabled={scale >= MAX_ZOOM}
                    focusableWhenDisabled
                    onClick={() => {
                      zoomBy(2);
                    }}
                  />
                }
              >
                <ZoomIn />
              </TooltipTrigger>
              <TooltipContent>{t("studio.zoomTexture")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("studio.fit")}
                    aria-pressed={zoom === "fit"}
                    onClick={() => {
                      setZoom("fit");
                    }}
                  />
                }
              >
                <Maximize />
              </TooltipTrigger>
              <TooltipContent>{t("studio.fit")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Toggle
                    size="sm"
                    aria-label={t("studio.pixelGrid")}
                    pressed={showGrid}
                    onPressedChange={setShowGrid}
                  />
                }
              >
                <Grid3x3 />
              </TooltipTrigger>
              <TooltipContent>{t("studio.pixelGrid")}</TooltipContent>
            </Tooltip>
          </span>
        </div>
        <ToolOptions
          tool={tool}
          size={size}
          mirror={mirror}
          shade={shade}
          shadeStrength={shadeStrength}
          fillScope={fillScope}
          onSize={setSize}
          onMirror={setMirror}
          onShade={setShade}
          onShadeStrength={setShadeStrength}
          onFillScope={setFillScope}
        />
        <output
          className={status ? "text-xs text-muted-foreground" : "sr-only"}
          aria-live="polite"
        >
          {t.message(status)}
        </output>
        <p className="sr-only" aria-live="polite">
          {shortcutNote}
        </p>
        <div
          ref={textureFrame}
          className={cn(
            "max-h-[70dvh] overflow-auto",
            zoom === "fit" && "flex justify-center",
          )}
        >
          <TextureCanvas
            store={store}
            tool={tool}
            settings={settings}
            interaction={interaction}
            scale={scale}
            showGrid={showGrid}
            highlight={highlightedPixels}
            onZoom={zoomTo}
            onPick={onPick}
            onPainted={onPainted}
            onStatus={showStatus}
          />
        </div>
        <ColorControls
          color={color}
          layer={layer}
          recent={recent}
          onChange={setColor}
        />
      </section>

      <section
        aria-label={t("studio.livePreview")}
        className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground ph-no-capture sm:p-4"
      >
        <ModelCanvas
          store={store}
          tool={tool}
          settings={settings}
          interaction={interaction}
          onPick={onPick}
          onPainted={onPainted}
          onStatus={showStatus}
          frameClassName="min-h-56"
          actions={
            // On phones the texture toolbar is a screen away from the model,
            // so the model gets its own Undo and Redo.
            <span className="ml-auto flex gap-1 sm:hidden">
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-coarse:size-9"
                aria-label={t("common.undo")}
                disabled={!snapshot.canUndo}
                focusableWhenDisabled
                onClick={() => {
                  store.undo();
                }}
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-coarse:size-9"
                aria-label={t("common.redo")}
                disabled={!snapshot.canRedo}
                focusableWhenDisabled
                onClick={() => {
                  store.redo();
                }}
              >
                <Redo2 />
              </Button>
            </span>
          }
        />
        <Button
          ref={saveButton}
          disabled={work.busy}
          onClick={() => void save()}
        >
          {props.isNew ? t("common.saveLibrary") : t("studio.saveChanges")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {!props.isNew && (
            <Button
              variant="outline"
              className="flex-1"
              disabled={work.busy}
              onClick={() => void saveCopy()}
            >
              {t("common.saveCopy")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex-1"
            disabled={work.busy}
            onClick={requestExit}
          >
            {t("common.cancel")}
          </Button>
        </div>
        <SkinIssueAlerts
          issues={issues}
          highlighted={highlight}
          onHighlight={setHighlight}
          onAllFixed={() => saveButton.current?.focus()}
          onRepair={(id) => {
            store.apply((pixels, builder) => {
              repairSkin(id, pixels, store.getSnapshot().variant, builder);
            });
            setHighlight(null);
            void analytics.capture("editor_check_fix_applied", { issue: id });
          }}
          onVariant={(variant) => {
            store.setVariant(variant);
          }}
        />
        <div className="flex flex-col gap-1.5">
          <span id={modelId} className="text-sm font-medium">
            {t("common.model")}
          </span>
          <ModelSelector
            aria-labelledby={modelId}
            layout="stacked"
            value={snapshot.variant}
            onValueChange={(variant) => {
              store.setVariant(variant);
            }}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-8 max-w-full self-start text-left whitespace-normal"
                  onClick={convertArms}
                />
              }
            >
              {snapshot.variant === "classic"
                ? t("studio.convertArmsSlim")
                : t("studio.convertArmsClassic")}
            </TooltipTrigger>
            <TooltipContent>
              {t("studio.changesArmPixelsModelUndoRestoresThem")}
            </TooltipContent>
          </Tooltip>
        </div>
        <PartActions
          layer={layer}
          visibility={visibility}
          onAction={transformPart}
        />
        <VisibleParts
          visibility={visibility}
          onVisibilityChange={setVisibility}
        />
      </section>

      <AlertDialog
        open={shown !== null}
        onOpenChange={(open) => {
          if (open) return;
          setConfirm(null);
          navigation.reset?.();
        }}
      >
        <AlertDialogContent>
          {shown && (
            <ConfirmBody
              confirm={shown}
              draftsOff={draftsOff}
              onCopy={() => {
                setConfirm(null);
                void saveCopy();
              }}
              onReplace={() => {
                setConfirm(null);
                void save(true);
              }}
              onUnkept={() => {
                setConfirm(null);
                void saveUnkept();
              }}
              onDiscard={() => {
                setConfirm(null);
                void discardAndLeave();
              }}
              onKeepDraft={() => {
                setConfirm(null);
                void keepDraftAndLeave();
              }}
              onDownload={() => {
                setConfirm(null);
                void download();
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
  draftsOff: boolean;
  onCopy: () => void;
  onReplace: () => void;
  onUnkept: () => void;
  onDiscard: () => void;
  onKeepDraft: () => void;
  onDownload: () => void;
}) {
  const t = useT();
  const { confirm } = props;
  const reason =
    confirm.kind === "failed" || confirm.kind === "draftFailed"
      ? t.message(confirm.message)
      : "";
  const text = {
    changed: [
      t("studio.skinChangedAnotherTab"),
      t("studio.saveYoursCopyReplaceOtherVersion"),
    ],
    removed: [t("studio.skinWasRemoved"), t("studio.saveWorkCopyKeep")],
    failed: [
      t("studio.skinCouldNotSaved"),
      `${reason} ${t("studio.youCanStillUseWithoutSaving")}`,
    ],
    draftFailed: [
      t("studio.draftNotKept"),
      `${reason} ${t("studio.downloadPngKeepWork")}`.trim(),
    ],
    leave: [
      t("studio.closeEditor"),
      props.draftsOff
        ? t("studio.draftsOffSoClosingLosesChanges")
        : t("studio.keepChangesDraftDiscardThem"),
    ],
  }[confirm.kind];
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{text[0]}</AlertDialogTitle>
        <AlertDialogDescription>{text[1]}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>
          {confirm.kind === "leave" || confirm.kind === "draftFailed"
            ? t("studio.keepEditing")
            : t("common.cancel")}
        </AlertDialogCancel>
        {confirm.kind === "changed" && (
          <Button variant="outline" onClick={props.onReplace}>
            {t("studio.replace")}
          </Button>
        )}
        {(confirm.kind === "changed" || confirm.kind === "removed") && (
          <Button onClick={props.onCopy}>{t("common.saveCopy")}</Button>
        )}
        {confirm.kind === "failed" && (
          <Button onClick={props.onUnkept}>
            {t("studio.useWithoutSaving")}
          </Button>
        )}
        {confirm.kind === "leave" && (
          <Button variant="destructive" onClick={props.onDiscard}>
            {t("studio.discardChanges")}
          </Button>
        )}
        {confirm.kind === "draftFailed" && (
          <Button onClick={props.onDownload}>
            <Download data-icon="inline-start" />
            {t("common.downloadPng")}
          </Button>
        )}
        {confirm.kind === "leave" && !props.draftsOff && (
          <Button onClick={props.onKeepDraft}>
            {t("studio.keepDraftClose")}
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}
