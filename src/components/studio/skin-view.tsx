"use client";

import { Box } from "lucide-react";
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
 * or after a lost context, it shows `fallback` instead.
 */
export function SkinView(props: {
  skinUrl: string | null;
  capeUrl?: string;
  variant: SkinVariant;
  label: string;
  fallback?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  /** Increments when a viewer starts, so texture effects run again. */
  const [ready, setReady] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    let current: SkinViewer;
    try {
      current = new SkinViewer({
        canvas,
        width: frame.clientWidth || 300,
        height: frame.clientHeight || 360,
        zoom: 0.85,
        enableControls: true,
      });
    } catch {
      setFailed(true);
      return;
    }
    current.controls.enablePan = false;
    current.controls.enableZoom = false;
    current.playerWrapper.rotation.y = FRONT;
    current.animation = new IdleAnimation();
    viewerRef.current = current;
    setReady((n) => n + 1);
    const resize = new ResizeObserver(() => {
      if (frame.clientWidth && frame.clientHeight)
        current.setSize(frame.clientWidth, frame.clientHeight);
    });
    resize.observe(frame);
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      resize.disconnect();
      current.dispose();
      viewerRef.current = null;
    };
  }, []);

  // Each load owns its image. A superseded load is cancelled before it can
  // draw, so only the latest skin and cape reach the viewer.
  useEffect(() => {
    const viewer = viewerRef.current;
    const url = props.skinUrl;
    if (!viewer || !url) return;
    const owner = new AbortController();
    const model = props.variant === "slim" ? "slim" : "default";
    runSkinEffect(
      withSkinImageEffect(url, (image) => {
        if (!viewer.disposed) viewer.loadSkin(image, { model });
      }),
      owner.signal,
    ).catch(() => {
      if (!owner.signal.aborted) setFailed(true);
    });
    return () => owner.abort();
  }, [ready, props.skinUrl, props.variant]);

  const capeUrl = ensureHttpsTextureUrl(props.capeUrl) ?? undefined;
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (!capeUrl) {
      viewer.resetCape();
      viewer.playerWrapper.rotation.y = FRONT;
      return;
    }
    const owner = new AbortController();
    viewer.playerWrapper.rotation.y = BACK;
    // A cape that does not load leaves the skin visible without it.
    runSkinEffect(
      withSkinImageEffect(capeUrl, (image) => {
        if (!viewer.disposed) viewer.loadCape(image);
      }),
      owner.signal,
    ).catch(() => {
      if (!owner.signal.aborted && !viewer.disposed) viewer.resetCape();
    });
    return () => owner.abort();
  }, [ready, capeUrl]);

  return (
    <div
      ref={frameRef}
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
