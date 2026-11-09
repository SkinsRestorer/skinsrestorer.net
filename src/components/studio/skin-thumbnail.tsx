"use client";

import { useEffect, useRef } from "react";
import type { SkinVariant } from "@/lib/skin";
import { cn } from "@/lib/utils";

type Part = readonly [
  sx: number,
  sy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
];

/** Front faces of each part, placed on a 16×32 figure. */
function frontParts(variant: SkinVariant, legacy: boolean): Part[] {
  const arm = variant === "slim" ? 3 : 4;
  const base: Part[] = [
    [8, 8, 8, 8, 4, 0],
    [20, 20, 8, 12, 4, 8],
    [44, 20, arm, 12, 4 - arm, 8],
    legacy ? [44, 20, arm, 12, 12, 8] : [36, 52, arm, 12, 12, 8],
    [4, 20, 4, 12, 4, 20],
    legacy ? [4, 20, 4, 12, 8, 20] : [20, 52, 4, 12, 8, 20],
    [40, 8, 8, 8, 4, 0],
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
    legacy ? [44, 20, arm, 8, 12, 8] : [36, 52, arm, 8, 12, 8],
    [40, 8, 8, 8, 4, 0],
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
 * Draw a small front view of a skin PNG. It decodes in the browser only and
 * works for 64×64, legacy 64×32, and scaled skins.
 */
export function SkinThumbnail(props: {
  png: Blob;
  variant: SkinVariant;
  view?: "body" | "bust" | "head";
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = props.view ?? "body";
  useEffect(() => {
    const target = canvas.current;
    const context = target?.getContext("2d");
    if (!target || !context) return;
    let active = true;
    let bitmap: ImageBitmap | undefined;
    context.clearRect(0, 0, target.width, target.height);
    createImageBitmap(props.png).then(
      (image) => {
        bitmap = image;
        if (!active) return image.close();
        const scale = image.width / 64;
        const legacy = image.height * 2 === image.width;
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, target.width, target.height);
        const parts =
          view === "head"
            ? headParts
            : view === "bust"
              ? bustParts(props.variant, legacy)
              : frontParts(props.variant, legacy);
        for (const [sx, sy, w, h, dx, dy] of parts)
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
      },
      () => undefined,
    );
    return () => {
      active = false;
      bitmap?.close();
    };
  }, [props.png, props.variant, view]);
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
