import { message, type Message, type MessageKey } from "@/lib/messages";
import {
  paintableRegion,
  type FillScope,
  type PaintSettings,
  type PaintTool,
  type Rgba,
} from "@/lib/skin-paint";
import type { SkinEditorStore } from "@/lib/skin-editor-store";

/** "paint" applies the tool; "move" leaves pointers to scroll or rotate the view. */
export type EditorInteraction = "paint" | "move";

export interface EditorSurfaceProps {
  readonly store: SkinEditorStore;
  readonly tool: PaintTool;
  readonly settings: PaintSettings;
  readonly interaction: EditorInteraction;
  /** Called when the eyedropper, or Alt with any tool, picks a color. */
  readonly onPick: (color: Rgba) => void;
  /** Called after a tool changes pixels with the color it used. */
  readonly onPainted: () => void;
  /** Short status text, for example why a click did nothing. */
  readonly onStatus: (message: Message) => void;
}

export const toolLabels: Record<PaintTool, MessageKey> = {
  pencil: "editor.pencil",
  eraser: "editor.eraser",
  shade: "common.shade",
  fill: "editor.fill",
  eyedropper: "editor.pickColor",
};

function blockedMessage(settings: PaintSettings) {
  return message(
    settings.layer === "base"
      ? "common.pixelNotVisiblePartBaseLayer"
      : "common.pixelNotVisiblePartOuterLayer",
  );
}

/** Tools that use the brush size. */
export function usesBrush(tool: PaintTool) {
  return tool === "pencil" || tool === "eraser" || tool === "shade";
}

/**
 * Tools that mirror their change. Fill everywhere replaces one exact color,
 * so a mirror adds nothing to it.
 */
export function usesMirror(tool: PaintTool, fillScope: FillScope) {
  if (tool === "fill") return fillScope !== "everywhere";
  return tool !== "eyedropper";
}

/**
 * Start the tool at a pixel. Pencil, eraser, and shade start a stroke that the caller
 * continues and ends; fill and pick finish at once. With `line` (Shift), a
 * brush tool draws a straight line from the end of its last stroke on the
 * same face and finishes at once. Without a line to draw, it starts a stroke.
 * With `pick` (Alt), any tool picks the color instead and stays selected.
 */
export function startTool(
  props: EditorSurfaceProps,
  x: number,
  y: number,
  options: {
    surfaceLock?: boolean;
    pickColor?: Rgba;
    line?: boolean;
    pick?: boolean;
  } = {},
): "stroke" | "done" | "blocked" {
  const { store, tool, settings } = props;
  if (tool === "eyedropper" || options.pick) {
    props.onPick(options.pickColor ?? store.colorAt(x, y));
    return "done";
  }
  if (tool === "fill") {
    if (store.fill(settings, x, y)) {
      props.onPainted();
      return "done";
    }
    if (!paintableRegion(store.getSnapshot().variant, settings, x, y)) {
      props.onStatus(blockedMessage(settings));
      return "blocked";
    }
    return "done";
  }
  if (tool === "eraser" && settings.layer === "base") {
    props.onStatus(message("editor.javaEditionAlwaysShowsBaseLayerOpaque"));
    return "blocked";
  }
  if (options.line && store.lineTo(tool, settings, x, y)) {
    props.onPainted();
    return "done";
  }
  if (!paintableRegion(store.getSnapshot().variant, settings, x, y)) {
    props.onStatus(blockedMessage(settings));
    // A 2D stroke can still start here and move onto a face.
    if (options.surfaceLock) return "blocked";
  }
  return store.beginStroke(tool, settings, x, y, options)
    ? "stroke"
    : "blocked";
}
