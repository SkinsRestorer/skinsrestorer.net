import type { SkinVariant } from "./skin";
import { emptyPixels, type SkinDocument } from "./skin-document";
import {
  applyPatch,
  EditHistory,
  PatchBuilder,
  type SkinPatch,
} from "./skin-history";
import {
  fillFace,
  linePoints,
  paintableRegion,
  readPixel,
  toolColor,
  type PaintSettings,
  type Rgba,
} from "./skin-paint";
import { sameRegion, SKIN_SIZE, type SkinRegion } from "./skin-regions";

export interface SkinEditorSnapshot {
  /** Changes on every pixel or model change. */
  readonly revision: number;
  readonly variant: SkinVariant;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly painting: boolean;
}

interface Stroke {
  readonly color: Rgba;
  readonly settings: PaintSettings;
  readonly builder: PatchBuilder;
  /** With surface lock, the stroke stays on the face where it started. */
  readonly lock?: SkinRegion;
  last?: readonly [number, number];
}

/**
 * Own the pixel document and its history. Views read pixels from here and
 * subscribe for changes; they never keep their own copy of the skin.
 */
export class SkinEditorStore {
  readonly pixels = emptyPixels();
  private variant: SkinVariant = "classic";
  private readonly history = new EditHistory();
  private stroke: Stroke | undefined;
  private readonly listeners = new Set<() => void>();
  private current: SkinEditorSnapshot = {
    revision: 0,
    variant: "classic",
    canUndo: false,
    canRedo: false,
    painting: false,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.current;

  private emit(changedPixels: boolean) {
    this.current = {
      revision: this.current.revision + (changedPixels ? 1 : 0),
      variant: this.variant,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
      painting: this.stroke !== undefined,
    };
    for (const listener of this.listeners) listener();
  }

  document(): SkinDocument {
    return { pixels: this.pixels.slice(), variant: this.variant };
  }

  /** Replace the document. History starts again for the new skin. */
  load(document: SkinDocument) {
    this.stroke = undefined;
    this.pixels.set(document.pixels);
    this.variant = document.variant;
    this.history.clear();
    this.emit(true);
  }

  /** Open another skin as one undo step, so an accidental open can be undone. */
  replace(document: SkinDocument) {
    this.endStroke();
    const builder = new PatchBuilder(this.pixels);
    for (let pixel = 0; pixel < SKIN_SIZE * SKIN_SIZE; pixel++)
      builder.write(pixel, document.pixels.subarray(pixel * 4, pixel * 4 + 4));
    const patch = builder.finish();
    if (!patch && document.variant === this.variant) return;
    this.history.push({
      indices: patch?.indices ?? new Uint16Array(),
      before: patch?.before ?? new Uint8ClampedArray(),
      after: patch?.after ?? new Uint8ClampedArray(),
      variant:
        document.variant === this.variant
          ? undefined
          : { before: this.variant, after: document.variant },
    });
    this.variant = document.variant;
    this.emit(true);
  }

  colorAt(x: number, y: number) {
    return readPixel(this.pixels, x, y);
  }

  /**
   * Start a pencil or eraser stroke. A stroke from pointer down to pointer up
   * becomes one undo step.
   */
  beginStroke(
    tool: "pencil" | "eraser",
    settings: PaintSettings,
    x: number,
    y: number,
    options: { surfaceLock?: boolean } = {},
  ) {
    this.endStroke();
    const color = toolColor(tool, settings.layer, settings.color);
    if (!color) return false;
    const lock = options.surfaceLock
      ? paintableRegion(this.variant, settings, x, y)
      : undefined;
    if (options.surfaceLock && !lock) return false;
    this.stroke = {
      color,
      settings,
      builder: new PatchBuilder(this.pixels),
      lock,
    };
    this.strokeTo(x, y);
    return true;
  }

  /** Paint every pixel on the line from the last sample, so fast moves leave no gaps. */
  strokeTo(x: number, y: number) {
    const stroke = this.stroke;
    if (!stroke) return;
    if (stroke.lock && !paintableOn(stroke, this.variant, x, y)) return;
    const points = stroke.last
      ? linePoints(stroke.last[0], stroke.last[1], x, y)
      : [[x, y] as const];
    let changed = false;
    for (const [px, py] of points) {
      if (!paintableOn(stroke, this.variant, px, py)) continue;
      changed =
        stroke.builder.write(py * SKIN_SIZE + px, stroke.color) || changed;
    }
    stroke.last = [x, y];
    if (changed) this.emit(true);
  }

  endStroke() {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = undefined;
    const patch = stroke.builder.finish();
    if (patch) this.history.push(patch);
    this.emit(false);
  }

  /** Undo a stroke in progress, for example after a lost pointer. */
  cancelStroke() {
    const stroke = this.stroke;
    if (!stroke) return;
    this.stroke = undefined;
    const patch = stroke.builder.finish();
    if (patch) applyPatch(this.pixels, patch, "undo");
    this.emit(patch !== undefined);
  }

  fill(settings: PaintSettings, x: number, y: number) {
    this.endStroke();
    const builder = new PatchBuilder(this.pixels);
    fillFace(this.pixels, builder, this.variant, settings, x, y);
    return this.commit(builder.finish());
  }

  /** Apply a prepared change, such as a skin check repair, as one undo step. */
  apply(change: (pixels: Uint8ClampedArray, builder: PatchBuilder) => void) {
    this.endStroke();
    const builder = new PatchBuilder(this.pixels);
    change(this.pixels, builder);
    return this.commit(builder.finish());
  }

  setVariant(variant: SkinVariant) {
    if (variant === this.variant) return;
    this.endStroke();
    const patch: SkinPatch = {
      indices: new Uint16Array(),
      before: new Uint8ClampedArray(),
      after: new Uint8ClampedArray(),
      variant: { before: this.variant, after: variant },
    };
    this.variant = variant;
    this.history.push(patch);
    this.emit(true);
  }

  undo() {
    this.endStroke();
    const patch = this.history.undo();
    if (!patch) return false;
    applyPatch(this.pixels, patch, "undo");
    if (patch.variant) this.variant = patch.variant.before;
    this.emit(true);
    return true;
  }

  redo() {
    this.endStroke();
    const patch = this.history.redo();
    if (!patch) return false;
    applyPatch(this.pixels, patch, "redo");
    if (patch.variant) this.variant = patch.variant.after;
    this.emit(true);
    return true;
  }

  private commit(patch: SkinPatch | undefined) {
    if (!patch) return false;
    this.history.push(patch);
    this.emit(true);
    return true;
  }
}

function paintableOn(
  stroke: Stroke,
  variant: SkinVariant,
  x: number,
  y: number,
) {
  const region = paintableRegion(variant, stroke.settings, x, y);
  if (!region) return false;
  return !stroke.lock || sameRegion(region, stroke.lock);
}
