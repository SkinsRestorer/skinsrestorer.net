import {
  paintableRegion,
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
  /** Called when the eyedropper picks a color. */
  readonly onPick: (color: Rgba) => void;
  /** Called after a tool changes pixels with the color it used. */
  readonly onPainted: () => void;
  /** Short status text, for example why a click did nothing. */
  readonly onStatus: (message: string) => void;
}

export const toolLabels: Record<PaintTool, { label: string; key: string }> = {
  pencil: { label: "Pencil", key: "B" },
  eraser: { label: "Eraser", key: "E" },
  shade: { label: "Shade", key: "S" },
  fill: { label: "Fill face", key: "G" },
  eyedropper: { label: "Pick color", key: "I" },
};

export function blockedMessage(settings: PaintSettings) {
  return `That pixel is not on a visible part of the ${settings.layer} layer.`;
}

/** Tools that use the brush size. */
export function usesBrush(tool: PaintTool) {
  return tool === "pencil" || tool === "eraser" || tool === "shade";
}

/**
 * Start the tool at a pixel. Pencil, eraser, and shade start a stroke that the caller
 * continues and ends; fill and pick finish at once.
 */
export function startTool(
  props: EditorSurfaceProps,
  x: number,
  y: number,
  options: { surfaceLock?: boolean; pickColor?: Rgba } = {},
): "stroke" | "done" | "blocked" {
  const { store, tool, settings } = props;
  if (tool === "eyedropper") {
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
    props.onStatus(
      "Java Edition always shows the base layer as opaque, so it cannot be erased. Paint over it instead.",
    );
    return "blocked";
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
