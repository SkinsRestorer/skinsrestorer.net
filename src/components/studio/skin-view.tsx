"use client";

import { Box } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IdleAnimation, SkinViewer } from "skinview3d";
import {
  runSkinEffect,
  withSkinImageEffect,
  type SkinVariant,
} from "@/lib/skin";
import { ensureHttpsTextureUrl } from "@/lib/textures";
import { useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";

const FRONT = -0.5;
const BACK = Math.PI + 0.5;

/**
 * The interactive 3D view of the selected skin. Drag or use the arrow keys to
 * turn it. Choosing a cape turns the model to show its back. Without WebGL,
 * or while the context is lost, it shows `fallback` instead.
 */
export function SkinView(props: {
  skinUrl: string | null;
  capeUrl?: string | undefined;
  variant: SkinVariant;
  label: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  /** Draws one frame while the animation loop is paused. */
  const redrawRef = useRef(() => {});
  /** Increments when a viewer starts, so texture effects run again. */
  const [ready, setReady] = useState(0);
  /** WebGL is missing. */
  const [noWebGl, setNoWebGl] = useState(false);
  /** The browser took the WebGL context away. It can give it back. */
  const [contextLost, setContextLost] = useState(false);
  /** The skin URL whose image could not load. A new skin tries again. */
  const [badSkin, setBadSkin] = useState<string | null>(null);
  const failed =
    noWebGl || contextLost || (badSkin !== null && badSkin === props.skinUrl);
  /** Whether the frame is on screen. The idle loop runs only while it is. */
  const [onScreen, setOnScreen] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect((): (() => void) | undefined => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return undefined;
    let current: SkinViewer;
    try {
      current = new SkinViewer({
        canvas,
        width: frame.clientWidth || 300,
        height: frame.clientHeight || 360,
        zoom: 0.85,
        enableControls: true,
        // The loop starts only when the idle animation can be seen.
        renderPaused: true,
      });
    } catch {
      // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- Report failure to initialize the external WebGL viewer.
      setNoWebGl(true);
      return undefined;
    }
    current.controls.enablePan = false;
    current.controls.enableZoom = false;
    current.playerWrapper.rotation.y = FRONT;
    viewerRef.current = current;
    // While the loop is paused, draw at most once for each animation frame.
    let frameRequest = 0;
    const redraw = () => {
      if (frameRequest || !current.renderPaused) return;
      frameRequest = requestAnimationFrame(() => {
        frameRequest = 0;
        if (current.renderPaused && !current.disposed) current.render();
      });
    };
    redrawRef.current = redraw;
    current.controls.addEventListener("change", redraw);
    setReady((n) => n + 1);
    const resize = new ResizeObserver(() => {
      if (frame.clientWidth && frame.clientHeight)
        current.setSize(frame.clientWidth, frame.clientHeight);
      redraw();
    });
    resize.observe(frame);
    // A new pixel ratio resizes the drawing buffer, which clears it.
    window.addEventListener("resize", redraw);
    const visibility = new IntersectionObserver(([entry]) => {
      setOnScreen(entry?.isIntersecting ?? true);
    });
    visibility.observe(frame);
    // Preventing the default lets the browser restore the context. three.js
    // uploads the textures again, and the viewer restarts its own loop.
    const lost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const restored = () => {
      setContextLost(false);
      redraw();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(frameRequest);
      redrawRef.current = () => {};
      current.controls.removeEventListener("change", redraw);
      visibility.disconnect();
      window.removeEventListener("resize", redraw);
      resize.disconnect();
      current.dispose();
      viewerRef.current = null;
    };
  }, []);

  // The idle sway stops when the user asks for less motion. Setting an
  // animation restarts it and resets the pose, so only a change in the motion
  // setting replaces it.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (reduceMotion) viewer.animation = null;
    else viewer.animation ??= new IdleAnimation();
    redrawRef.current();
  }, [ready, reduceMotion]);

  // Without the sway, or off screen, the loop pauses and the view draws only
  // when it changes. Pausing keeps the sway where it was.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.renderPaused = reduceMotion || !onScreen;
    redrawRef.current();
  }, [ready, reduceMotion, onScreen]);

  // Each load owns its image. A superseded load is cancelled before it can
  // draw, so only the latest skin and cape reach the viewer.
  useEffect((): (() => void) | undefined => {
    const viewer = viewerRef.current;
    const url = props.skinUrl;
    if (!viewer || !url) return undefined;
    const owner = new AbortController();
    const model = props.variant === "slim" ? "slim" : "default";
    runSkinEffect(
      withSkinImageEffect(url, (image) => {
        if (viewer.disposed || owner.signal.aborted) return;
        viewer.loadSkin(image, { model });
        redrawRef.current();
        // A skin that failed before can load on a later try.
        setBadSkin((bad) => (bad === url ? null : bad));
      }),
      owner.signal,
    ).catch(() => {
      if (!owner.signal.aborted) setBadSkin(url);
    });
    return () => {
      owner.abort();
    };
  }, [ready, props.skinUrl, props.variant]);

  const capeUrl = ensureHttpsTextureUrl(props.capeUrl) ?? undefined;
  useEffect((): (() => void) | undefined => {
    const viewer = viewerRef.current;
    if (!viewer) return undefined;
    if (!capeUrl) {
      viewer.resetCape();
      viewer.playerWrapper.rotation.y = FRONT;
      redrawRef.current();
      return undefined;
    }
    const owner = new AbortController();
    viewer.playerWrapper.rotation.y = BACK;
    redrawRef.current();
    // A cape that does not load leaves the skin visible without it.
    runSkinEffect(
      withSkinImageEffect(capeUrl, (image) => {
        if (viewer.disposed) return;
        viewer.loadCape(image);
        redrawRef.current();
      }),
      owner.signal,
    ).catch(() => {
      if (owner.signal.aborted || viewer.disposed) return;
      viewer.resetCape();
      redrawRef.current();
    });
    return () => {
      owner.abort();
    };
  }, [ready, capeUrl]);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The WebGL viewer is a named image that also rotates with the arrow keys; no native element fits.
    <div
      ref={frameRef}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The image is drawn on a WebGL canvas, so it cannot be an <img>.
      role="img"
      aria-roledescription={t("studio.3dModel")}
      aria-label={props.label}
      tabIndex={failed ? undefined : 0}
      onKeyDown={(event) => {
        const step = { ArrowLeft: -0.3, ArrowRight: 0.3 }[event.key];
        const viewer = viewerRef.current;
        if (!viewer || step === undefined) return;
        event.preventDefault();
        viewer.playerWrapper.rotation.y += step;
        redrawRef.current();
      }}
      className={cn(
        "relative h-[300px] touch-none overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-[360px]",
        !failed && "cursor-grab active:cursor-grabbing",
        props.className,
      )}
    >
      <canvas ref={canvasRef} hidden={failed} className="block" />
      {failed && (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          {props.fallback ?? (
            <Box className="text-muted-foreground" aria-hidden="true" />
          )}
          <p className="max-w-64 text-sm text-muted-foreground">
            {t("studio.3dPreviewUnavailableYouCanStillUpload")}
          </p>
        </div>
      )}
    </div>
  );
}
