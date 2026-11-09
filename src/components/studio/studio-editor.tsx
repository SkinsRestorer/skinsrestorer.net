"use client";

import { useBlocker } from "@tanstack/react-router";
import { Download, Grid3x3, Maximize, ZoomIn, ZoomOut } from "lucide-react";
import posthog from "posthog-js";
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
import { ColorControls, toHex } from "@/components/editor/color-panel";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import type { EditorInteraction } from "@/components/editor/editor-types";
import { LayerToggle, VisibleParts } from "@/components/editor/layers-panel";
import { ModelCanvas } from "@/components/editor/model-canvas";
import { SkinIssueAlerts } from "@/components/editor/skin-issue-alerts";
import { TextureCanvas } from "@/components/editor/texture-canvas";
import { ModelSelector } from "@/components/model-selector";
import { SaveStatus, type SaveState } from "@/components/save-status";
import { CustomTimeAgo } from "@/components/time-ago";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import type { EditorSession, SaveResult } from "@/lib/editor-session";
import { checkSkin, repairSkin, type SkinIssueId } from "@/lib/skin-check";
import { exportSkinPng } from "@/lib/skin-document";
import type { SkinEditorStore } from "@/lib/skin-editor-store";
import {
  allPartsVisible,
  type PaintSettings,
  type PaintTool,
  type Rgba,
} from "@/lib/skin-paint";
import { SKIN_SIZE, type SkinLayer } from "@/lib/skin-regions";
import { useT } from "@/lib/i18n-react";
import { downloadSkin } from "@/lib/hooks/use-skin-library";
import { cn } from "@/lib/utils";

const HISTORY_MARK = "skinsrestorerStudioEditor";

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

type Confirm =
  | { readonly kind: "changed" | "removed" | "leave" }
  | { readonly kind: "failed"; readonly message: string };

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
  const [tool, setTool] = useState<PaintTool>("pencil");
  const [layer, setLayer] = useState<SkinLayer>("base");
  const [color, setColor] = useState<Rgba>([76, 118, 160, 255]);
  const [recent, setRecent] = useState<Rgba[]>([]);
  const [visibility, setVisibility] = useState(allPartsVisible);
  const [interaction, setInteraction] = useState<EditorInteraction>("paint");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(5);
  const [showGrid, setShowGrid] = useState(true);
  const [highlight, setHighlight] = useState<SkinIssueId | null>(null);
  const [status, setStatus] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const textureFrame = useRef<HTMLDivElement>(null);
  const modelId = useId();
  const exited = useRef(false);
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
        t(
          "Leave without saving? Drafts are off, so your changes will be lost.",
        ),
      ),
    enableBeforeUnload: () => unsafeToLeave,
    disabled: !unsafeToLeave,
  });

  // Back returns to the view instead of leaving the page.
  useEffect(() => {
    window.history.pushState(
      { ...window.history.state, [HISTORY_MARK]: true },
      "",
    );
    const pop = () => {
      if (exited.current) return;
      if (session.getSnapshot().dirty) {
        window.history.pushState(
          { ...window.history.state, [HISTORY_MARK]: true },
          "",
        );
        setConfirm({ kind: "leave" });
      } else exit();
    };
    window.addEventListener("popstate", pop);
    return () => {
      window.removeEventListener("popstate", pop);
      if (window.history.state?.[HISTORY_MARK]) window.history.back();
    };
  }, [session, exit]);

  const onPainted = useCallback(() => {
    setStatus("");
    if (tool === "eraser" || tool === "eyedropper") return;
    const used: Rgba =
      layer === "base" ? [color[0], color[1], color[2], 255] : color;
    setRecent((list) =>
      [used, ...list.filter((c) => c.some((v, i) => v !== used[i]))].slice(
        0,
        8,
      ),
    );
  }, [tool, layer, color]);

  const onPick = useCallback(
    (picked: Rgba) => {
      if (picked[3] === 0) {
        showStatus(t("That pixel is clear."));
        return;
      }
      setColor(picked);
      setTool("pencil");
      showStatus(t("Picked {color}.", { color: toHex(picked) }));
    },
    [showStatus, t],
  );

  const changeLayer = useCallback(
    (next: SkinLayer) => {
      setLayer(next);
      if (next === "base" && tool === "eraser") setTool("pencil");
    },
    [tool],
  );

  // Keyboard shortcuts work everywhere on the page except in text fields.
  const shortcuts = useAsRef({ layer, changeLayer, requestExit, confirm });
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
      if (key === "escape") {
        // Menus and dialogs close themselves first.
        if (shortcuts.current.confirm || document.querySelector("[role=menu]"))
          return;
        shortcuts.current.requestExit();
        event.preventDefault();
        return;
      }
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
        setFitScale(Math.max(3, Math.min(8, Math.floor(width / SKIN_SIZE))));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const download = async () => {
    try {
      const bytes = await exportSkinPng(store.pixels);
      downloadSkin(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/png" }),
        work.target.name,
      );
      posthog.capture("editor_exported_png");
    } catch (cause) {
      toast.error(
        t("The PNG could not be made: {error}", {
          error: t(errorMessage(cause)),
        }),
      );
    }
  };

  const handle = (result: SaveResult, kind: "save" | "copy") => {
    if (result.kind === "saved") {
      posthog.capture("editor_saved", { kind, kept: !!result.skin });
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
  const saveCopy = async () => handle(await session.saveCopy(), "copy");

  const zoomBy = (step: number) =>
    setZoom(Math.max(3, Math.min(24, scale + step)));

  const [saveState, saveLabel]: [SaveState, string] = work.busy
    ? ["saving", t("Saving")]
    : work.dirty
      ? [
          "unsaved",
          draftsOff ? t("Unsaved changes") : t("Unsaved changes, draft kept"),
        ]
      : work.target.skinId
        ? ["saved", t("Saved")]
        : draftsOff
          ? ["unavailable", t("Cannot be kept in this browser")]
          : ["unsaved", t("Not saved yet")];

  return (
    <TooltipProvider>
      <section
        aria-label={t("Skin being edited")}
        className="ph-no-capture flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground sm:p-4"
      >
        <div className="flex min-h-8 items-center gap-2">
          <h2 className="truncate text-base font-semibold">
            {props.isNew
              ? t("New skin")
              : t("Editing {name}", { name: work.target.name })}
          </h2>
          <SaveStatus state={saveState} label={saveLabel} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto"
            aria-label={t("Download PNG")}
            title={t("Download PNG")}
            onClick={() => void download()}
          >
            <Download />
          </Button>
        </div>
        {draftsOff && (
          <Alert>
            <AlertTitle>{t("Drafts are off")}</AlertTitle>
            <AlertDescription>
              {t("Download the PNG to keep your work.")}
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
            onTool={setTool}
            onInteraction={setInteraction}
            onUndo={() => store.undo()}
            onRedo={() => store.redo()}
          />
          <LayerToggle layer={layer} onLayerChange={changeLayer} />
          <span className="ml-auto flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("Zoom texture out")}
              onClick={() => zoomBy(-2)}
            >
              <ZoomOut />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("Zoom texture in")}
              onClick={() => zoomBy(2)}
            >
              <ZoomIn />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("Fit")}
              aria-pressed={zoom === "fit"}
              onClick={() => setZoom("fit")}
            >
              <Maximize />
            </Button>
            <Toggle
              size="sm"
              aria-label={t("Pixel grid")}
              pressed={showGrid}
              onPressedChange={setShowGrid}
            >
              <Grid3x3 />
            </Toggle>
          </span>
        </div>
        <output
          className={status ? "text-xs text-muted-foreground" : "sr-only"}
          aria-live="polite"
        >
          {t(status)}
        </output>
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
        aria-label={t("Live preview")}
        className="ph-no-capture flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground sm:p-4"
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
        />
        <Button disabled={work.busy} onClick={() => void save()}>
          {props.isNew ? t("Save to library") : t("Save changes")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {!props.isNew && (
            <Button
              variant="outline"
              className="flex-1"
              disabled={work.busy}
              onClick={() => void saveCopy()}
            >
              {t("Save as copy")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="flex-1"
            disabled={work.busy}
            onClick={requestExit}
          >
            {t("Cancel")}
          </Button>
        </div>
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
        <div className="flex flex-col gap-1.5">
          <span id={modelId} className="text-sm font-medium">
            {t("Model")}
          </span>
          <ModelSelector
            aria-labelledby={modelId}
            layout="stacked"
            value={snapshot.variant}
            onValueChange={(variant) => store.setVariant(variant)}
          />
        </div>
        <VisibleParts
          visibility={visibility}
          onVisibilityChange={setVisibility}
        />
      </section>

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
              draftsOff={draftsOff}
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
                setConfirm(null);
                await session.discard();
                exit();
              }}
              onKeepDraft={async () => {
                setConfirm(null);
                await session.flush();
                exit();
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
}) {
  const t = useT();
  const { confirm } = props;
  const text = {
    changed: [
      t("This skin changed in another tab"),
      t("Save yours as a copy, or replace the other version."),
    ],
    removed: [
      t("This skin was removed"),
      t("Save your work as a copy to keep it."),
    ],
    failed: [
      t("The skin could not be saved"),
      confirm.kind === "failed"
        ? `${t(confirm.message)} ${t("You can still use it without saving.")}`
        : "",
    ],
    leave: [
      t("Close the editor?"),
      props.draftsOff
        ? t("Drafts are off, so closing loses your changes.")
        : t("Keep your changes as a draft, or discard them."),
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
          {confirm.kind === "leave" ? t("Keep editing") : t("Cancel")}
        </AlertDialogCancel>
        {confirm.kind === "changed" && (
          <Button variant="outline" onClick={props.onReplace}>
            {t("Replace it")}
          </Button>
        )}
        {(confirm.kind === "changed" || confirm.kind === "removed") && (
          <Button onClick={props.onCopy}>{t("Save as copy")}</Button>
        )}
        {confirm.kind === "failed" && (
          <Button onClick={props.onUnkept}>{t("Use without saving")}</Button>
        )}
        {confirm.kind === "leave" && (
          <Button variant="destructive" onClick={props.onDiscard}>
            {t("Discard changes")}
          </Button>
        )}
        {confirm.kind === "leave" && !props.draftsOff && (
          <Button onClick={props.onKeepDraft}>
            {t("Keep draft and close")}
          </Button>
        )}
      </AlertDialogFooter>
    </>
  );
}

/** Unsaved work from an earlier visit or another tab. */
export function DraftRecovery(props: {
  session: EditorSession;
  onContinue: () => void;
}) {
  const t = useT();
  const work = useSyncExternalStore(
    props.session.subscribe,
    props.session.getSnapshot,
    props.session.getSnapshot,
  );
  if (work.recovery.length === 0) return null;
  return (
    <div className="ph-no-capture">
      <Alert>
        <AlertTitle>{t("Continue unsaved changes?")}</AlertTitle>
        <AlertDescription>
          <ul className="flex flex-col gap-2">
            {work.recovery.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">
                  {draft.name}
                  {t(", changed")} <CustomTimeAgo date={draft.updatedAt} />
                </span>
                <span className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void props.session
                        .continueDraft(draft)
                        .then(() => {
                          posthog.capture("editor_opened", { source: "draft" });
                          props.onContinue();
                        })
                        .catch((cause) => toast.error(t(errorMessage(cause))))
                    }
                  >
                    {t("Continue")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void props.session.discardDraft(draft.id)}
                  >
                    {t("Discard")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
