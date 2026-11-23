"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { SkinVariant } from "@/lib/skin";
import { cn } from "@/lib/utils";

type Part = readonly [
  sx: number,
  sy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
  /** Draw mirrored, as Java Edition copies a legacy right limb to the left. */
  flip?: boolean,
];

const HAT: Part = [40, 8, 8, 8, 4, 0];

/** The left limb front of a legacy skin: the right limb front, mirrored. */
function legacyLeft(sx: number, w: number, h: number, dx: number, dy: number) {
  // The mirror of the full 4-pixel front; a slim arm shows its outer columns.
  return [sx + 4 - w, 20, w, h, dx, dy, true] as const satisfies Part;
}

/** Front faces of each part, placed on a 16×32 figure. */
function frontParts(variant: SkinVariant, legacy: boolean): Part[] {
  const arm = variant === "slim" ? 3 : 4;
  const base: Part[] = [
    [8, 8, 8, 8, 4, 0],
    [20, 20, 8, 12, 4, 8],
    [44, 20, arm, 12, 4 - arm, 8],
    legacy ? legacyLeft(44, arm, 12, 12, 8) : [36, 52, arm, 12, 12, 8],
    [4, 20, 4, 12, 4, 20],
    legacy ? legacyLeft(4, 4, 12, 8, 20) : [20, 52, 4, 12, 8, 20],
    HAT,
  ];
  if (legacy) return base;
  return [
    ...base,
    [20, 36, 8, 12, 4, 8],
    [44, 36, arm, 12, 4 - arm, 8],
    [52, 52, arm, 12, 12, 8],
    [4, 36, 4, 12, 4, 20],
    [4, 52, 4, 12, 8, 20],
  ];
}

/** Head, chest, and upper arms of both layers, on a 16×16 square. */
function bustParts(variant: SkinVariant, legacy: boolean): Part[] {
  const arm = variant === "slim" ? 3 : 4;
  const left = 4 - arm;
  const base: Part[] = [
    [8, 8, 8, 8, 4, 0],
    [20, 20, 8, 8, 4, 8],
    [44, 20, arm, 8, left, 8],
    legacy ? legacyLeft(44, arm, 8, 12, 8) : [36, 52, arm, 8, 12, 8],
    HAT,
  ];
  if (legacy) return base;
  return [
    ...base,
    [20, 36, 8, 8, 4, 8],
    [44, 36, arm, 8, left, 8],
    [52, 52, arm, 8, 12, 8],
  ];
}

const headParts: Part[] = [
  [8, 8, 8, 8, 0, 0],
  [40, 8, 8, 8, 0, 0],
];

/**
 * Whether Java Edition shows the hat of a legacy skin. It hides the hat when
 * the right half of the image has no pixel below half opacity, like
 * `legacyHatVisible` in the editor import.
 */
function legacyHatShows(image: ImageBitmap) {
  const probe = document.createElement("canvas");
  probe.width = 32;
  probe.height = 32;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return true;
  context.imageSmoothingEnabled = false;
  const half = image.width / 2;
  context.drawImage(image, half, 0, half, image.height, 0, 0, 32, 32);
  const { data } = context.getImageData(0, 0, 32, 32);
  for (let i = 3; i < data.length; i += 4)
    if ((data[i] ?? 0) < 128) return true;
  return false;
}

/**
 * Draw a small front view of a skin PNG. It decodes in the browser only and
 * works for 64×64, legacy 64×32, and scaled skins.
 */
export function SkinThumbnail(props: {
  png: Blob;
  /**
   * The PNG's content hash. Library reads return new Blob objects for the
   * same bytes; with a hash, the thumbnail decodes again only when the bytes
   * change.
   */
  hash?: string;
  variant: SkinVariant;
  view?: "body" | "bust" | "head";
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = props.view ?? "body";
  const currentPng = useEffectEvent(() => props.png);
  const source = props.hash ?? props.png;
  useEffect((): (() => void) | undefined => {
    const target = canvas.current;
    const context = target?.getContext("2d");
    if (!target || !context) return undefined;
    let active = true;
    context.clearRect(0, 0, target.width, target.height);
    createImageBitmap(currentPng()).then(
      (image) => {
        if (!active) {
          image.close();
          return;
        }
        const scale = image.width / 64;
        const legacy = image.height * 2 === image.width;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, target.width, target.height);
        const all =
          view === "head"
            ? headParts
            : view === "bust"
              ? bustParts(props.variant, legacy)
              : frontParts(props.variant, legacy);
        // The hat is the only part drawn from the head's outer layer.
        const parts =
          legacy && !legacyHatShows(image)
            ? all.filter(([sx, sy]) => !(sx === 40 && sy === 8))
            : all;
        for (const [sx, sy, w, h, dx, dy, flip] of parts) {
          context.save();
          // Mirror around the part's own column range.
          if (flip) context.setTransform(-1, 0, 0, 1, 2 * dx + w, 0);
          context.drawImage(
            image,
            sx * scale,
            sy * scale,
            w * scale,
            h * scale,
            dx,
            dy,
            w,
            h,
          );
          context.restore();
        }
        // The canvas keeps the pixels; free the decoded image now.
        image.close();
      },
      () => {},
    );
    return () => {
      active = false;
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `source` names the PNG content, so a re-read Blob with the same hash does not redraw.
  }, [source, props.variant, view]);
  return (
    <canvas
      ref={canvas}
      width={view === "head" ? 8 : 16}
      height={view === "head" ? 8 : view === "bust" ? 16 : 32}
      aria-hidden="true"
      className={cn("shrink-0 [image-rendering:pixelated]", props.className)}
    />
  );
}
