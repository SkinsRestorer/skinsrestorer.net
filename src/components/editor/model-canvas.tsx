"use client";

import { Box, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SkinViewer, WalkingAnimation } from "skinview3d";
import {
  DataTexture,
  MOUSE,
  NearestFilter,
  Raycaster,
  RGBAFormat,
  TOUCH,
  UnsignedByteType,
  Vector2,
  type Mesh,
} from "three";
import { useAsRef } from "@/hooks/use-as-ref";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { readPixel } from "@/lib/skin-paint";
import {
  SKIN_SIZE,
  skinParts,
  type SkinLayer,
  type SkinPart,
} from "@/lib/skin-regions";
import { hitToPixel } from "@/lib/skin-uv";
import {
  startTool,
  type EditorSurfaceProps,
} from "@/components/editor/editor-types";
import { useT } from "@/lib/i18n-react";

/** Copy straight RGBA pixels with rows flipped for a texture with flipY off. */
export function copyFlipped(source: Uint8ClampedArray, target: Uint8Array) {
  const stride = SKIN_SIZE * 4;
  for (let y = 0; y < SKIN_SIZE; y++)
    target.set(
      source.subarray(y * stride, (y + 1) * stride),
      (SKIN_SIZE - 1 - y) * stride,
    );
}

interface PaintTarget {
  readonly x: number;
  readonly y: number;
  readonly color: readonly [number, number, number, number];
}

/**
 * The live 3D model. skinview3d draws the model; the editor owns the texture.
 * The texture reads the document pixels directly, so the preview never
 * changes them (loadSkin would clear hat pixels on opaque skins).
 */
export function ModelCanvas(
  props: EditorSurfaceProps & { readonly frameClassName?: string },
) {
  const t = useT();
  const { store, interaction, settings } = props;
  const propsRef = useAsRef(props);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [animate, setAnimate] = useState(false);
  /** A fill or pick that waits for the finger to lift, as a tap. */
  const tap = useRef<{ id: number; target: PaintTarget } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    let viewer: SkinViewer;
    try {
      viewer = new SkinViewer({
        canvas,
        width: frame.clientWidth || 300,
        height: frame.clientHeight || 360,
        zoom: 0.8,
        enableControls: true,
      });
    } catch {
      setFailure("The 3D model needs WebGL, which is off in this browser.");
      return;
    }
    viewerRef.current = viewer;
    viewer.controls.enablePan = false;
    viewer.controls.enableZoom = false;
    viewer.autoRotate = false;

    const data = new Uint8Array(SKIN_SIZE * SKIN_SIZE * 4);
    const texture = new DataTexture(
      data,
      SKIN_SIZE,
      SKIN_SIZE,
      RGBAFormat,
      UnsignedByteType,
    );
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    const skin = viewer.playerObject.skin;
    skin.map = texture;
    skin.visible = true;

    let frameRequest = 0;
    const sync = () => {
      frameRequest = 0;
      copyFlipped(store.pixels, data);
      texture.needsUpdate = true;
      const variant = store.getSnapshot().variant;
      const model = variant === "slim" ? "slim" : "default";
      if (skin.modelType !== model) skin.modelType = model;
    };
    sync();
    const unsubscribe = store.subscribe(() => {
      if (!frameRequest) frameRequest = requestAnimationFrame(sync);
    });

    const resize = new ResizeObserver(() => {
      if (frame.clientWidth && frame.clientHeight)
        viewer.setSize(frame.clientWidth, frame.clientHeight);
    });
    resize.observe(frame);

    const lost = (event: Event) => {
      event.preventDefault();
      setFailure("The 3D model stopped. The browser lost its graphics.");
    };
    canvas.addEventListener("webglcontextlost", lost);

    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      if (frameRequest) cancelAnimationFrame(frameRequest);
      unsubscribe();
      resize.disconnect();
      skin.map = null;
      texture.dispose();
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [store, attempt, propsRef]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const part of skinParts) {
      viewer.playerObject.skin[part].innerLayer.visible =
        settings.visibility[part].base;
      viewer.playerObject.skin[part].outerLayer.visible =
        settings.visibility[part].outer;
    }
  }, [settings.visibility, attempt, failure]);

  const painting = interaction === "paint" && !animate;
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    // In paint mode one pointer paints. A right drag or two fingers turn the
    // model. In move mode every drag turns the model.
    viewer.controls.mouseButtons = painting
      ? { RIGHT: MOUSE.ROTATE }
      : { LEFT: MOUSE.ROTATE, RIGHT: MOUSE.ROTATE };
    viewer.controls.touches = painting
      ? { TWO: TOUCH.DOLLY_ROTATE }
      : { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE };
    viewer.animation = animate ? new WalkingAnimation() : null;
    if (!animate) viewer.playerObject.resetJoints();
  }, [painting, animate, attempt, failure]);

  /** The pixel under the pointer on the active layer, if nothing covers it. */
  const pick = (
    clientX: number,
    clientY: number,
  ): PaintTarget | "covered" | undefined => {
    const viewer = viewerRef.current;
    const canvas = canvasRef.current;
    if (!viewer || !canvas) return undefined;
    const rect = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new Raycaster();
    raycaster.setFromCamera(pointer, viewer.camera);
    viewer.scene.updateMatrixWorld(true);
    const meshes = new Map<Mesh, { part: SkinPart; layer: SkinLayer }>();
    for (const part of skinParts) {
      const bodyPart = viewer.playerObject.skin[part];
      if (bodyPart.innerLayer.visible)
        meshes.set(bodyPart.innerLayer as Mesh, { part, layer: "base" });
      if (bodyPart.outerLayer.visible)
        meshes.set(bodyPart.outerLayer as Mesh, { part, layer: "outer" });
    }
    const { variant } = store.getSnapshot();
    for (const hit of raycaster.intersectObjects([...meshes.keys()], false)) {
      const owner = meshes.get(hit.object as Mesh);
      if (!owner || !hit.uv || hit.faceIndex == null) continue;
      const pixel = hitToPixel(
        variant,
        owner.part,
        owner.layer,
        hit.faceIndex,
        hit.uv,
      );
      if (!pixel) continue;
      const color = readPixel(store.pixels, pixel.x, pixel.y);
      const { tool, settings: current } = propsRef.current;
      if (tool === "eyedropper") {
        // Pick what the eye sees: skip clear outer pixels.
        if (owner.layer === "outer" && color[3] === 0) continue;
        return { x: pixel.x, y: pixel.y, color };
      }
      if (owner.layer === current.layer)
        return { x: pixel.x, y: pixel.y, color };
      // A clear outer pixel does not hide the base layer below it.
      if (owner.layer === "outer" && color[3] === 0) continue;
      return "covered";
    }
    return undefined;
  };

  const coverMessage = () =>
    propsRef.current.settings.layer === "base"
      ? t(
          "The outer layer covers that spot. Hide the outer layer of that part to paint the base below it.",
        )
      : t("Point at the outer layer of a visible part.");

  const rotate = (angle: number) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.playerWrapper.rotation.y += angle;
  };
  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (viewer)
      viewer.zoom = Math.min(2.5, Math.max(0.4, viewer.zoom * factor));
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Turn model left")}
          disabled={!!failure}
          onClick={() => rotate(-Math.PI / 4)}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Turn model right")}
          disabled={!!failure}
          onClick={() => rotate(Math.PI / 4)}
        >
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Zoom model out")}
          disabled={!!failure}
          onClick={() => zoom(1 / 1.2)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Zoom model in")}
          disabled={!!failure}
          onClick={() => zoom(1.2)}
        >
          <ZoomIn />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!!failure}
          onClick={() => {
            const viewer = viewerRef.current;
            if (!viewer) return;
            viewer.playerWrapper.rotation.y = 0;
            viewer.zoom = 0.8;
            viewer.resetCameraPose();
          }}
        >
          {t("Reset view")}
        </Button>
        <Toggle
          variant="outline"
          size="sm"
          pressed={animate}
          disabled={!!failure}
          onPressedChange={setAnimate}
        >
          {t("Walk")}
        </Toggle>
      </div>
      <div
        ref={frameRef}
        className={cn(
          "relative min-h-80 flex-1 overflow-hidden rounded-lg bg-muted",
          props.frameClassName,
        )}
      >
        {failure ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Box className="text-muted-foreground" aria-hidden="true" />
            <output className="text-sm text-muted-foreground">
              {t(failure)}
            </output>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailure(null);
                setAttempt((n) => n + 1);
              }}
            >
              {t("Try again")}
            </Button>
          </div>
        ) : null}
        <canvas
          key={attempt}
          ref={canvasRef}
          hidden={!!failure}
          aria-label={
            painting
              ? t(
                  "3D model. Drag to paint. Use a right drag, two fingers, or the turn buttons to rotate.",
                )
              : t("3D model. Drag to turn it.")
          }
          className={cn("block", painting ? "cursor-crosshair" : "cursor-grab")}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (!painting) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (!event.isPrimary) {
              // A second finger turns the model; drop what the first started.
              tap.current = null;
              store.cancelStroke();
              return;
            }
            const target = pick(event.clientX, event.clientY);
            if (target === "covered") {
              propsRef.current.onStatus(coverMessage());
              return;
            }
            if (!target) return;
            // A finger may become a two-finger turn, so fill and pick wait
            // for the tap to end.
            const { tool } = propsRef.current;
            if (
              event.pointerType === "touch" &&
              (tool === "fill" || tool === "eyedropper")
            ) {
              tap.current = { id: event.pointerId, target };
              return;
            }
            const result = startTool(propsRef.current, target.x, target.y, {
              surfaceLock: true,
              pickColor: target.color,
            });
            if (result === "stroke")
              event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!store.getSnapshot().painting) return;
            const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
            for (const sample of samples.length ? samples : [event]) {
              const target = pick(sample.clientX, sample.clientY);
              if (target && target !== "covered")
                store.strokeTo(target.x, target.y);
            }
          }}
          onPointerUp={(event) => {
            const pending = tap.current;
            tap.current = null;
            if (pending?.id === event.pointerId) {
              startTool(propsRef.current, pending.target.x, pending.target.y, {
                surfaceLock: true,
                pickColor: pending.target.color,
              });
              return;
            }
            if (!store.getSnapshot().painting) return;
            store.endStroke();
            propsRef.current.onPainted();
          }}
          onPointerCancel={() => {
            tap.current = null;
            store.cancelStroke();
          }}
        />
      </div>
      {!failure && (
        <p className="text-xs text-muted-foreground">
          {painting
            ? t("Right drag or two fingers to turn.")
            : t("Drag to turn the model.")}
        </p>
      )}
    </div>
  );
}
