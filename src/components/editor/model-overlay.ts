import { SKIN_SIZE } from "@/lib/skin-regions";

/** Copy straight RGBA pixels with rows flipped for a texture with flipY off. */
export function copyFlipped(source: Uint8ClampedArray, target: Uint8Array) {
  const stride = SKIN_SIZE * 4;
  for (let y = 0; y < SKIN_SIZE; y++)
    target.set(
      source.subarray(y * stride, (y + 1) * stride),
      (SKIN_SIZE - 1 - y) * stride,
    );
}

/** Pixels to mark on the model under the pointer. */
export interface HoverOverlay {
  readonly source: readonly number[];
  readonly mirror: readonly number[];
  /** An outer pixel that covers the base layer, or a pixel the tool cannot change. */
  readonly blocked: readonly number[];
}

const BLOCKED_TINT = [220, 38, 38] as const;

/**
 * Mark the hover footprint in the texture copy that the GPU draws. The
 * document pixels stay the same: this changes only `target`, which already
 * holds the flipped copy of the document.
 */
export function paintOverlay(target: Uint8Array, overlay: HoverOverlay) {
  const tint = (
    index: number,
    amount: number,
    minAlpha: number,
    color?: readonly [number, number, number],
  ) => {
    const x = index % SKIN_SIZE;
    const y = Math.floor(index / SKIN_SIZE);
    const at = ((SKIN_SIZE - 1 - y) * SKIN_SIZE + x) * 4;
    // `at` points into the texture, so every channel read is defined.
    const channel = (i: number) => target[at + i] ?? 0;
    const light = channel(0) * 0.299 + channel(1) * 0.587 + channel(2) * 0.114;
    const ink =
      color ??
      (channel(3) > 0 && light > 140
        ? ([0, 0, 0] as const)
        : ([255, 255, 255] as const));
    ink.forEach((value, c) => {
      target[at + c] = Math.round(channel(c) * (1 - amount) + value * amount);
    });
    target[at + 3] = Math.max(channel(3), minAlpha);
  };
  for (const index of overlay.mirror) tint(index, 0.35, 150);
  for (const index of overlay.source) tint(index, 0.6, 200);
  for (const index of overlay.blocked) tint(index, 0.65, 220, BLOCKED_TINT);
}
