"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { cn, required } from "@/lib/utils";
import { describePixel, SKIN_SIZE, skinRegions } from "@/lib/skin-regions";
import {
  startTool,
  usesBrush,
  usesMirror,
  type EditorSurfaceProps,
} from "@/components/editor/editor-types";
import { brushArea, type PixelRect } from "@/lib/skin-paint";
import { changedRect } from "@/lib/skin-document";
import { useT } from "@/lib/i18n-react";

interface TextureCanvasProps extends EditorSurfaceProps {
  /** Size of one skin pixel in CSS pixels. */
  readonly scale: number;
  readonly showGrid: boolean;
  /** Pixel indexes to outline, for example from the skin check. */
  readonly highlight?: readonly number[] | undefined;
  /** Asks for a new scale when two fingers pinch the texture. */
  readonly onZoom?: (scale: number) => void;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Scroll the nearest scrolling ancestor, such as the texture frame. What it
 * cannot scroll goes to the page, so two fingers also scroll a fitted texture.
 */
function panBy(element: Element, dx: number, dy: number) {
  const parent = scrollParent(element);
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

function scrollParent(element: Element) {
  let parent = element.parentElement;
  while (parent && !/auto|scroll/u.test(getComputedStyle(parent).overflow))
    parent = parent.parentElement;
  return parent;
}

/** The distance to move a span so it fits inside [start, end]. */
function overflowBy(low: number, high: number, start: number, end: number) {
  if (high - low > end - start || low < start) return low - start;
  return high > end ? high - end : 0;
}

/**
 * Scroll the least amount that shows a texture pixel, so the keyboard cursor
 * stays visible at high zoom.
 */
function revealPixel(canvas: HTMLCanvasElement, x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  const cellWidth = rect.width / SKIN_SIZE;
  const cellHeight = rect.height / SKIN_SIZE;
  const left = rect.left + x * cellWidth;
  const top = rect.top + y * cellHeight;
  const parent = scrollParent(canvas);
  const view = parent
    ? parent.getBoundingClientRect()
    : { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const dx = overflowBy(left, left + cellWidth, view.left, view.right);
  const dy = overflowBy(top, top + cellHeight, view.top, view.bottom);
  if (dx !== 0 || dy !== 0) panBy(canvas, dx, dy);
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
  /**
   * The skin at 1:1, uploaded again only when the pixels change. `pixels`
   * holds what the canvas shows, to find what a stroke changed.
   */
  const textureCache = useRef<{
    revision: number;
    canvas: HTMLCanvasElement;
    pixels: Uint8ClampedArray;
  }>(null);
  /** Draws the view, or only the part inside a rectangle of skin pixels. */
  const drawRef = useRef<((dirty?: PixelRect) => void) | null>(null);
  /** Theme colors, read again only when the theme changes. */
  const colorCache = useRef<{
    revision: number;
    muted: string;
    background: string;
    foreground: string;
    destructive: string;
  }>(null);
  const [cursor, setCursor] = useState({ x: 8, y: 8 });
  const [focused, setFocused] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [themeRevision, setThemeRevision] = useState(0);
  const [ratio, setRatio] = useState(1);
  const [revision, setRevision] = useState(() => store.getSnapshot().revision);
  const instructionsId = useId();
  /** Touch points on the canvas, to tell one-finger paint from two-finger pan. */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  /** A fill or pick that waits for the finger to lift, as a tap. */
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);
  /** The pointer that paints the current stroke. Others cannot move it. */
  const strokePointer = useRef<{ id: number; touch: boolean } | null>(null);
  /** The finger distance and scale when a pinch started. */
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  /**
   * The texture point under the pinch center, as a fraction of the canvas
   * size, where it was on screen, and the scale it was measured at. A new
   * scale keeps it there.
   */
  const anchor = useRef<{
    u: number;
    v: number;
    x: number;
    y: number;
    from: number;
  } | null>(null);

  useLayoutEffect(() => {
    const point = anchor.current;
    const canvas = canvasRef.current;
    anchor.current = null;
    if (!point || !canvas || point.from === scale) return;
    const rect = canvas.getBoundingClientRect();
    panBy(
      canvas,
      rect.left + point.u * rect.width - point.x,
      rect.top + point.v * rect.height - point.y,
    );
  }, [scale]);

  // A stroke changes a few pixels on each sample. Redraw only those, at most
  // once for each animation frame, instead of the whole canvas. The end of
  // the stroke and every other change redraw everything.
  useEffect(() => {
    let frameRequest = 0;
    const strokeFrame = () => {
      frameRequest = 0;
      const cache = textureCache.current;
      const dirty = cache && changedRect(cache.pixels, store.pixels);
      if (!cache || !dirty) return;
      cache.canvas
        .getContext("2d")
        ?.putImageData(
          new ImageData(store.pixels.slice(), SKIN_SIZE, SKIN_SIZE),
          0,
          0,
          dirty.x,
          dirty.y,
          dirty.width,
          dirty.height,
        );
      cache.pixels.set(store.pixels);
      drawRef.current?.(dirty);
    };
    const unsubscribe = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      if (snapshot.painting) {
        if (!frameRequest) frameRequest = requestAnimationFrame(strokeFrame);
        return;
      }
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      setRevision(snapshot.revision);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(frameRequest);
    };
  }, [store]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeRevision((n) => n + 1);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  // Browser zoom and a move to another screen change the pixel ratio. Redraw
  // at the new ratio so the texture stays sharp.
  useEffect(() => {
    let query: MediaQueryList | undefined;
    const update = () => {
      query?.removeEventListener("change", update);
      const next = window.devicePixelRatio || 1;
      setRatio(next);
      query = matchMedia(`(resolution: ${next}dppx)`);
      query.addEventListener("change", update);
    };
    update();
    return () => query?.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return undefined;
    const size = SKIN_SIZE * scale;
    const pixels = Math.round(size * ratio);
    // Assigning a size reallocates the buffer, even when it stays the same.
    if (canvas.width !== pixels) canvas.width = pixels;
    if (canvas.height !== pixels) canvas.height = pixels;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const cell = canvas.width / SKIN_SIZE;
    const variant = store.getSnapshot().variant;
    // Reading computed styles right after a render forces a style recalc.
    if (colorCache.current?.revision !== themeRevision)
      colorCache.current = {
        revision: themeRevision,
        muted: themeColor(canvas, "--muted", "#eee"),
        background: themeColor(canvas, "--background", "#fff"),
        foreground: themeColor(canvas, "--foreground", "#111"),
        destructive: themeColor(canvas, "--destructive", "#d33"),
      };
    const { muted, background, foreground, destructive } = colorCache.current;

    const draw = (dirty?: PixelRect) => {
      ctx.save();
      if (dirty) {
        // Every layer below draws again inside the clip, so the rest of the
        // canvas can stay as it is.
        const left = Math.floor(dirty.x * cell);
        const top = Math.floor(dirty.y * cell);
        ctx.beginPath();
        ctx.rect(
          left,
          top,
          Math.ceil((dirty.x + dirty.width) * cell) - left,
          Math.ceil((dirty.y + dirty.height) * cell) - top,
        );
        ctx.clip();
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Checks show transparency. Each skin pixel holds a 2×2 check.
      const checkKey = `${background} ${muted}`;
      if (checkCache.current?.key !== checkKey) {
        const checks = document.createElement("canvas");
        checks.width = SKIN_SIZE * 2;
        checks.height = SKIN_SIZE * 2;
        const checksCtx = required(
          checks.getContext("2d"),
          "2D canvas context",
        );
        checksCtx.fillStyle = background;
        checksCtx.fillRect(0, 0, checks.width, checks.height);
        checksCtx.fillStyle = muted;
        for (let y = 0; y < checks.height; y++)
          for (let x = y % 2; x < checks.width; x += 2)
            checksCtx.fillRect(x, y, 1, 1);
        checkCache.current = { key: checkKey, canvas: checks };
      }
      ctx.drawImage(
        checkCache.current.canvas,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      // A hover or cursor move redraws the view but leaves the pixels alone.
      if (textureCache.current?.revision !== revision) {
        const texture =
          textureCache.current?.canvas ?? document.createElement("canvas");
        texture.width = SKIN_SIZE;
        texture.height = SKIN_SIZE;
        const shown = store.pixels.slice();
        texture
          .getContext("2d")
          ?.putImageData(
            new ImageData(shown.slice(), SKIN_SIZE, SKIN_SIZE),
            0,
            0,
          );
        textureCache.current = { revision, canvas: texture, pixels: shown };
      }
      ctx.drawImage(
        textureCache.current.canvas,
        0,
        0,
        canvas.width,
        canvas.height,
      );

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
        const maskCtx = required(mask.getContext("2d"), "2D canvas context");
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
      ctx.drawImage(
        maskCache.current.canvas,
        0,
        0,
        canvas.width,
        canvas.height,
      );

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
        if (area?.mirror && usesMirror(tool, settings.fillScope))
          outline(area.mirror, true);
      };
      if (hover && interaction === "paint") footprint(hover.x, hover.y, false);
      if (focused) footprint(cursor.x, cursor.y, true);
      ctx.restore();
    };
    draw();
    drawRef.current = draw;
    return () => {
      drawRef.current = null;
    };
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
    ratio,
  ]);

  /**
   * The texture pixel under a point. With `outside`, a point off the canvas
   * gives its pixel position past the edge, so a stroke follows the pointer
   * out and back in instead of joining the two edge points.
   */
  const toPixel = (
    event: { clientX: number; clientY: number },
    outside = false,
  ): { x: number; y: number } | undefined => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * SKIN_SIZE,
    );
    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * SKIN_SIZE,
    );
    // A canvas without a size gives no position, and a line to it never ends.
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    if (!outside && (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE))
      return undefined;
    return { x, y };
  };

  const finishStroke = () => {
    strokePointer.current = null;
    if (store.endStroke()) propsRef.current.onPainted();
  };

  const applyAtCursor = (x: number, y: number, line: boolean) => {
    const result = startTool(propsRef.current, x, y, { line });
    if (result === "stroke") finishStroke();
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        // oxlint-disable-next-line jsx-a11y/no-interactive-element-to-noninteractive-role -- The paint canvas handles its own arrow and paint keys, which needs the application role.
        role="application"
        aria-label={t("editor.skinTexture6464Pixels")}
        aria-describedby={instructionsId}
        className={cn(
          "block max-w-none rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          interaction === "paint"
            ? "cursor-crosshair touch-none"
            : "touch-auto",
        )}
        onFocus={() => {
          setFocused(true);
          setAnnouncement(
            describePixel(store.getSnapshot().variant, cursor.x, cursor.y, t),
          );
        }}
        onBlur={() => {
          setFocused(false);
        }}
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
            const stride = event.shiftKey ? 4 : 1;
            const next = {
              x: Math.min(
                SKIN_SIZE - 1,
                Math.max(0, cursor.x + step[0] * stride),
              ),
              y: Math.min(
                SKIN_SIZE - 1,
                Math.max(0, cursor.y + step[1] * stride),
              ),
            };
            setCursor(next);
            revealPixel(event.currentTarget, next.x, next.y);
            setAnnouncement(
              describePixel(store.getSnapshot().variant, next.x, next.y, t),
            );
          } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            applyAtCursor(cursor.x, cursor.y, event.shiftKey);
          }
        }}
        onPointerDown={(event) => {
          if (interaction !== "paint") return;
          const touch = event.pointerType === "touch";
          const owner = strokePointer.current;
          // A palm that touches during a pen or mouse stroke is ignored. A
          // second finger during a finger stroke starts a pan below.
          if (owner && owner.id !== event.pointerId && !(owner.touch && touch))
            return;
          if (touch) {
            touches.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            if (touches.current.size > 1) {
              // A second finger pans and pinches the texture. Drop what the
              // first finger started, so a gesture never leaves a mark.
              tap.current = null;
              strokePointer.current = null;
              store.cancelStroke();
              const [a, b] = touches.current.values();
              pinch.current =
                a && b && touches.current.size === 2
                  ? { distance: distance(a, b), scale: propsRef.current.scale }
                  : null;
              return;
            }
          }
          // Only the main button paints, also for a pen's barrel button and
          // eraser end.
          if (!touch && event.button !== 0) return;
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
          if (
            startTool(propsRef.current, pixel.x, pixel.y, {
              line: event.shiftKey,
              pick: event.altKey,
            }) === "stroke"
          ) {
            strokePointer.current = { id: event.pointerId, touch };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        }}
        onPointerMove={(event) => {
          const owner = strokePointer.current;
          if (owner && owner.id !== event.pointerId) return;
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
              const start = pinch.current;
              const { onZoom, scale: current } = propsRef.current;
              const [a, b] = touches.current.values();
              if (start && start.distance > 0 && onZoom && a && b) {
                const zoomed = Math.round(
                  (start.scale * distance(a, b)) / start.distance,
                );
                if (zoomed !== current) {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = (a.x + b.x) / 2;
                  const y = (a.y + b.y) / 2;
                  anchor.current = {
                    u: (x - rect.left) / rect.width,
                    v: (y - rect.top) / rect.height,
                    x,
                    y,
                    from: current,
                  };
                  onZoom(zoomed);
                }
              }
              return;
            }
          } else if (event.pointerType !== "touch") {
            // Most moves stay on the same pixel. A new object would redraw
            // the whole canvas, which is large at high zoom.
            const pixel = toPixel(event) ?? null;
            setHover((current) =>
              current?.x === pixel?.x && current?.y === pixel?.y
                ? current
                : pixel,
            );
          }
          if (!owner || !store.getSnapshot().painting) return;
          // Older Safari versions lack getCoalescedEvents.
          const native = event.nativeEvent;
          const samples =
            "getCoalescedEvents" in native ? native.getCoalescedEvents() : [];
          for (const sample of samples.length > 0 ? samples : [event]) {
            const point = toPixel(sample, true);
            if (point) store.strokeTo(point.x, point.y);
          }
        }}
        onPointerUp={(event) => {
          touches.current.delete(event.pointerId);
          if (touches.current.size < 2) {
            // A pinch past the zoom limit leaves an anchor that no scale used.
            pinch.current = null;
            anchor.current = null;
          }
          const owner = strokePointer.current;
          if (owner && owner.id !== event.pointerId) return;
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
          if (touches.current.size < 2) {
            // A pinch past the zoom limit leaves an anchor that no scale used.
            pinch.current = null;
            anchor.current = null;
          }
          const owner = strokePointer.current;
          if (owner && owner.id !== event.pointerId) return;
          tap.current = null;
          strokePointer.current = null;
          store.cancelStroke();
        }}
        onPointerLeave={() => {
          setHover(null);
        }}
        onLostPointerCapture={finishStroke}
      />
      <p id={instructionsId} className="sr-only">
        {t("editor.useArrowKeysMovePixelCursorHold")}
      </p>
      <p className="min-h-4 text-xs text-muted-foreground" aria-hidden="true">
        {hover
          ? describePixel(store.getSnapshot().variant, hover.x, hover.y, t)
          : focused
            ? describePixel(store.getSnapshot().variant, cursor.x, cursor.y, t)
            : interaction === "paint" && (
                // Touch has no hover, so this line explains the gestures.
                <span className="hidden pointer-coarse:inline">
                  {t("editor.oneFingerPaintsTwoFingersScroll")}
                </span>
              )}
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
