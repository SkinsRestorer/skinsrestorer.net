import type { SkinVariant } from "./skin";

/** One undo step: changed pixels with their old and new RGBA bytes. */
export interface SkinPatch {
  readonly indices: Uint16Array;
  readonly before: Uint8ClampedArray;
  readonly after: Uint8ClampedArray;
  readonly variant?: {
    readonly before: SkinVariant;
    readonly after: SkinVariant;
  };
}

/** Collect pixel writes. A pixel keeps the value it had before the first write. */
export class PatchBuilder {
  private readonly positions = new Map<number, number>();
  private readonly indices: number[] = [];
  private readonly before: number[] = [];

  constructor(private readonly pixels: Uint8ClampedArray) {}

  write(pixel: number, rgba: ArrayLike<number>) {
    const at = pixel * 4;
    if (!this.positions.has(pixel)) {
      if (
        this.pixels[at] === rgba[0] &&
        this.pixels[at + 1] === rgba[1] &&
        this.pixels[at + 2] === rgba[2] &&
        this.pixels[at + 3] === rgba[3]
      )
        return false;
      this.positions.set(pixel, this.indices.length);
      this.indices.push(pixel);
      this.before.push(
        this.pixels[at],
        this.pixels[at + 1],
        this.pixels[at + 2],
        this.pixels[at + 3],
      );
    }
    this.pixels[at] = rgba[0];
    this.pixels[at + 1] = rgba[1];
    this.pixels[at + 2] = rgba[2];
    this.pixels[at + 3] = rgba[3];
    return true;
  }

  get size() {
    return this.indices.length;
  }

  /** Return the patch, without pixels that ended at their old value. */
  finish(): SkinPatch | undefined {
    const indices: number[] = [];
    const before: number[] = [];
    const after: number[] = [];
    this.indices.forEach((pixel, i) => {
      const at = pixel * 4;
      const old = this.before.slice(i * 4, i * 4 + 4);
      const current = Array.from(this.pixels.subarray(at, at + 4));
      if (old.every((value, c) => value === current[c])) return;
      indices.push(pixel);
      before.push(...old);
      after.push(...current);
    });
    if (indices.length === 0) return undefined;
    return {
      indices: Uint16Array.from(indices),
      before: Uint8ClampedArray.from(before),
      after: Uint8ClampedArray.from(after),
    };
  }
}

export function applyPatch(
  pixels: Uint8ClampedArray,
  patch: SkinPatch,
  direction: "undo" | "redo",
) {
  const source = direction === "undo" ? patch.before : patch.after;
  patch.indices.forEach((pixel, i) => {
    pixels.set(source.subarray(i * 4, i * 4 + 4), pixel * 4);
  });
}

export const HISTORY_LIMIT = 100;

export class EditHistory {
  private past: SkinPatch[] = [];
  private future: SkinPatch[] = [];

  constructor(private readonly limit = HISTORY_LIMIT) {}

  push(patch: SkinPatch) {
    this.past.push(patch);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  undo() {
    const patch = this.past.pop();
    if (patch) this.future.push(patch);
    return patch;
  }

  redo() {
    const patch = this.future.pop();
    if (patch) this.past.push(patch);
    return patch;
  }

  clear() {
    this.past = [];
    this.future = [];
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  get size() {
    return this.past.length;
  }
}
