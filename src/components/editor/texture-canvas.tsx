"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { cn } from "@/lib/utils";
import { describePixel, SKIN_SIZE, skinRegions } from "@/lib/skin-regions";
import {
  startTool,
  usesBrush,
  type EditorSurfaceProps,
} from "@/components/editor/editor-types";
import { brushArea, type PixelRect } from "@/lib/skin-paint";
import { useT } from "@/lib/i18n-react";

interface TextureCanvasProps extends EditorSurfaceProps {
  /** Size of one skin pixel in CSS pixels. */
  readonly scale: number;
  readonly showGrid: boolean;
  /** Pixel indexes to outline, for example from the skin check. */
  readonly highlight?: readonly number[];
}

/**
 * Scroll the nearest scrolling ancestor, such as the texture frame. What it
 * cannot scroll goes to the page, so two fingers also scroll a fitted texture.
 */
function panBy(element: Element, dx: number, dy: number) {
  let parent = element.parentElement;
  while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflow))
    parent = parent.parentElement;
  let restX = dx;
  let restY = dy;
  if (parent) {
    const { scrollLeft, scrollTop } = parent;
    parent.scrollBy(dx, dy);
    restX -= parent.scrollLeft - scrollLeft;
    restY -= parent.scrollTop - scrollTop;
  }
  if (Math.abs(restX) >= 1 || Math.abs(restY) >= 1)
    window.scrollBy(restX, restY);
}

function themeColor(element: Element, name: string, fallback: string) {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * The flat texture with face guides. The canvas is a focusable grid: arrow
 * keys move a pixel cursor and Space or Enter applies the tool.
 */
export function TextureCanvas(props: TextureCanvasProps) {
  const t = useT();
  const { store, tool, settings, scale, showGrid, highlight, interaction } =
    props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useAsRef(props);
  const maskCache = useRef<{ key: string; canvas: HTMLCanvasElement }>(null);
  const checkCache = useRef<{ key: string; canvas: HTMLCanvasElement }>(null);
  const [cursor, setCursor] = useState({ x: 8, y: 8 });
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [themeRevision, setThemeRevision] = useState(0);
  const [revision, setRevision] = useState(() => store.getSnapshot().revision);
  const instructionsId = useId();
  /** Touch points on the canvas, to tell one-finger paint from two-finger pan. */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  /** A fill or pick that waits for the finger to lift, as a tap. */
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(
    () =>
      store.subscribe(() => {
        setRevision(store.getSnapshot().revision);
      }),
    [store],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeRevision((n) => n + 1));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const size = SKIN_SIZE * scale;
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const cell = canvas.width / SKIN_SIZE;
    const variant = store.getSnapshot().variant;
    const muted = themeColor(canvas, "--muted", "#eee");
    const background = themeColor(canvas, "--background", "#fff");
    const foreground = themeColor(canvas, "--foreground", "#111");
    const destructive = themeColor(canvas, "--destructive", "#d33");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Checks show transparency. Each skin pixel holds a 2×2 check.
    const checkKey = `${background} ${muted}`;
    if (checkCache.current?.key !== checkKey) {
      const checks = document.createElement("canvas");
      checks.width = SKIN_SIZE * 2;
      checks.height = SKIN_SIZE * 2;
      const checksCtx = checks.getContext("2d")!;
      checksCtx.fillStyle = background;
      checksCtx.fillRect(0, 0, checks.width, checks.height);
      checksCtx.fillStyle = muted;
      for (let y = 0; y < checks.height; y++)
        for (let x = y % 2; x < checks.width; x += 2)
          checksCtx.fillRect(x, y, 1, 1);
      checkCache.current = { key: checkKey, canvas: checks };
    }
    ctx.drawImage(checkCache.current.canvas, 0, 0, canvas.width, canvas.height);

    const texture = document.createElement("canvas");
    texture.width = SKIN_SIZE;
    texture.height = SKIN_SIZE;
    texture
      .getContext("2d")
      ?.putImageData(
        new ImageData(store.pixels.slice(), SKIN_SIZE, SKIN_SIZE),
        0,
        0,
      );
    ctx.drawImage(texture, 0, 0, canvas.width, canvas.height);

    // Fade everything that the tool cannot change: unused pixels, the other
    // layer, and hidden parts. The active layer keeps full contrast.
    const maskKey = JSON.stringify([
      variant,
      settings.layer,
      settings.visibility,
      background,
    ]);
    if (maskCache.current?.key !== maskKey) {
      const mask = document.createElement("canvas");
      mask.width = SKIN_SIZE;
      mask.height = SKIN_SIZE;
      const maskCtx = mask.getContext("2d")!;
      const state = new Uint8Array(SKIN_SIZE * SKIN_SIZE);
      for (const region of skinRegions(variant)) {
        const active =
          region.layer === settings.layer &&
          settings.visibility[region.part][region.layer];
        for (let y = region.y; y < region.y + region.height; y++)
          for (let x = region.x; x < region.x + region.width; x++)
            state[y * SKIN_SIZE + x] = active ? 2 : 1;
      }
      maskCtx.fillStyle = background;
      for (let i = 0; i < state.length; i++) {
        if (state[i] === 2) continue;
        maskCtx.globalAlpha = state[i] === 1 ? 0.55 : 0.8;
        maskCtx.fillRect(i % SKIN_SIZE, Math.floor(i / SKIN_SIZE), 1, 1);
      }
      maskCache.current = { key: maskKey, canvas: mask };
    }
    ctx.drawImage(maskCache.current.canvas, 0, 0, canvas.width, canvas.height);

    if (showGrid && scale >= 6) {
      ctx.strokeStyle = foreground;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < SKIN_SIZE; i++) {
        const at = Math.round(i * cell) + 0.5;
        ctx.moveTo(at, 0);
        ctx.lineTo(at, canvas.height);
        ctx.moveTo(0, at);
        ctx.lineTo(canvas.width, at);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Face guides for the active layer.
    ctx.strokeStyle = foreground;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, ratio);
    for (const region of skinRegions(variant)) {
      if (region.layer !== settings.layer) continue;
      ctx.strokeRect(
        region.x * cell + 0.5,
        region.y * cell + 0.5,
        region.width * cell - 1,
        region.height * cell - 1,
      );
    }
    ctx.globalAlpha = 1;

    if (highlight?.length) {
      ctx.strokeStyle = destructive;
      ctx.lineWidth = Math.max(2, ratio * 2);
      for (const index of highlight)
        ctx.strokeRect(
          (index % SKIN_SIZE) * cell + 1,
          Math.floor(index / SKIN_SIZE) * cell + 1,
          cell - 2,
          cell - 2,
        );
    }

    const outline = (rect: PixelRect, dashed: boolean) => {
      ctx.setLineDash(dashed ? [cell / 4, cell / 4] : []);
      ctx.lineWidth = Math.max(2, ratio * 2);
      ctx.strokeStyle = foreground;
      ctx.strokeRect(
        rect.x * cell + 1,
        rect.y * cell + 1,
        rect.width * cell - 2,
        rect.height * cell - 2,
      );
      ctx.strokeStyle = background;
      ctx.lineWidth = Math.max(1, ratio);
      ctx.strokeRect(
        rect.x * cell + 3,
        rect.y * cell + 3,
        rect.width * cell - 6,
        rect.height * cell - 6,
      );
      ctx.setLineDash([]);
    };
    // The pixels the tool changes here: the brush square clipped to the face,
    // and its mirror image with a dashed line.
    const footprint = (x: number, y: number, solid: boolean) => {
      const area = brushArea(
        variant,
        usesBrush(tool) ? settings : { ...settings, size: 1 },
        x,
        y,
      );
      outline(area?.source ?? { x, y, width: 1, height: 1 }, !solid);
      if (area?.mirror && tool !== "eyedropper") outline(area.mirror, true);
    };
    if (hover && interaction === "paint") footprint(hover.x, hover.y, false);
    if (focused) footprint(cursor.x, cursor.y, true);
  }, [
    store,
    revision,
    settings,
    scale,
    showGrid,
    highlight,
    hover,
    focused,
    cursor,
    interaction,
    tool,
    themeRevision,
  ]);

  const toPixel = (event: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * SKIN_SIZE,
    );
    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * SKIN_SIZE,
    );
    if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return undefined;
    return { x, y };
  };

  const finishStroke = () => {
    if (!store.getSnapshot().painting) return;
    store.endStroke();
    propsRef.current.onPainted();
  };

  const applyAtCursor = (x: number, y: number) => {
    const result = startTool(propsRef.current, x, y);
    if (result === "stroke") finishStroke();
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-roledescription="skin texture"
        aria-label={t("Skin texture, 64 by 64 pixels")}
        aria-describedby={instructionsId}
        className={cn(
          "block max-w-none rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          interaction === "paint"
            ? "touch-none cursor-crosshair"
            : "touch-auto",
        )}
        onFocus={() => {
          setFocused(true);
          setAnnouncement(
            describePixel(store.getSnapshot().variant, cursor.x, cursor.y, t),
          );
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          const steps: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          };
          const step = steps[event.key];
          if (step) {
            event.preventDefault();
            const distance = event.shiftKey ? 4 : 1;
            const next = {
              x: Math.min(
                SKIN_SIZE - 1,
                Math.max(0, cursor.x + step[0] * distance),
              ),
              y: Math.min(
                SKIN_SIZE - 1,
                Math.max(0, cursor.y + step[1] * distance),
              ),
            };
            setCursor(next);
            setAnnouncement(
              describePixel(store.getSnapshot().variant, next.x, next.y, t),
            );
          } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            applyAtCursor(cursor.x, cursor.y);
          }
        }}
        onPointerDown={(event) => {
          if (interaction !== "paint") return;
          if (event.pointerType === "touch") {
            touches.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (touches.current.size > 1) {
              // A second finger pans the texture. Drop what the first finger
              // started, so a gesture never leaves a mark.
              tap.current = null;
              store.cancelStroke();
              return;
            }
          }
          if (event.pointerType === "mouse" && event.button !== 0) return;
          const pixel = toPixel(event);
          if (!pixel) return;
          event.preventDefault();
          setCursor(pixel);
          // A finger may become a two-finger pan, so fill and pick wait for a tap.
          if (
            event.pointerType === "touch" &&
            (propsRef.current.tool === "fill" ||
              propsRef.current.tool === "eyedropper")
          ) {
            tap.current = { id: event.pointerId, ...pixel };
            return;
          }
          if (startTool(propsRef.current, pixel.x, pixel.y) === "stroke")
            event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const last = touches.current.get(event.pointerId);
          if (last) {
            const panning = touches.current.size > 1;
            const next = { x: event.clientX, y: event.clientY };
            touches.current.set(event.pointerId, next);
            if (panning) {
              // Each finger moves the view by half its distance, so two fingers
              // together move it by their average.
              panBy(
                event.currentTarget,
                (last.x - next.x) / touches.current.size,
                (last.y - next.y) / touches.current.size,
              );
              return;
            }
          } else {
            setHover(toPixel(event) ?? null);
          }
          if (!store.getSnapshot().painting) return;
          const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
          for (const sample of samples.length ? samples : [event]) {
            const point = toPixel(sample);
            if (point) store.strokeTo(point.x, point.y);
          }
        }}
        onPointerUp={(event) => {
          touches.current.delete(event.pointerId);
          const pending = tap.current;
          tap.current = null;
          if (pending?.id === event.pointerId) {
            const result = startTool(propsRef.current, pending.x, pending.y);
            if (result === "stroke") finishStroke();
            return;
          }
          finishStroke();
        }}
        onPointerCancel={(event) => {
          // The browser took the pointer, for example for a system gesture.
          touches.current.delete(event.pointerId);
          tap.current = null;
          store.cancelStroke();
        }}
        onPointerLeave={() => setHover(null)}
        onLostPointerCapture={finishStroke}
      />
      <p id={instructionsId} className="sr-only">
        {t(
          "Use the arrow keys to move the pixel cursor. Hold Shift to move four pixels. Press Space or Enter to use the selected tool.",
        )}
      </p>
      <p className="min-h-4 text-xs text-muted-foreground" aria-hidden="true">
        {hover
          ? describePixel(store.getSnapshot().variant, hover.x, hover.y, t)
          : focused
            ? describePixel(store.getSnapshot().variant, cursor.x, cursor.y, t)
            : null}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
