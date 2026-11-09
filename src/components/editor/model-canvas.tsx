"use client";

import { message, type Message } from "@/lib/messages";

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
import { readPixel, toolFootprint } from "@/lib/skin-paint";
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

/** An outer-layer pixel that hides the base pixel under the pointer. */
interface Covered {
  readonly covered: { readonly x: number; readonly y: number };
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
    const light =
      target[at] * 0.299 + target[at + 1] * 0.587 + target[at + 2] * 0.114;
    const ink =
      color ??
      (target[at + 3] > 0 && light > 140
        ? ([0, 0, 0] as const)
        : ([255, 255, 255] as const));
    for (let c = 0; c < 3; c++)
      target[at + c] = Math.round(
        target[at + c] * (1 - amount) + ink[c] * amount,
      );
    target[at + 3] = Math.max(target[at + 3], minAlpha);
  };
  for (const index of overlay.mirror) tint(index, 0.35, 150);
  for (const index of overlay.source) tint(index, 0.6, 200);
  for (const index of overlay.blocked) tint(index, 0.65, 220, BLOCKED_TINT);
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
  const [failure, setFailure] = useState<Message | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [animate, setAnimate] = useState(false);
  /** A fill or pick that waits for the finger to lift, as a tap. */
  const tap = useRef<{ id: number; target: PaintTarget } | null>(null);
  /** Moves the hover footprint. Set while a viewer exists. */
  const hover = useRef<{
    move: (clientX: number, clientY: number) => void;
    leave: () => void;
    refresh: () => void;
  } | null>(null);
  const painting = interaction === "paint" && !animate;
  const paintingRef = useAsRef(painting);

  /** The pixel under the pointer on the active layer, if nothing covers it. */
  const pick = (
    clientX: number,
    clientY: number,
  ): PaintTarget | Covered | undefined => {
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
      return { covered: { x: pixel.x, y: pixel.y } };
    }
    return undefined;
  };
  const pickRef = useAsRef(pick);

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
      setFailure(message("editor.webglUnavailable"));
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

    // The hover footprint is drawn only into `data`, the GPU copy. It never
    // reaches the document, so saves, drafts, and downloads never see it.
    let pointer: { x: number; y: number } | null = null;
    let blockedCursor = false;
    let frameRequest = 0;
    const footprint = (): HoverOverlay | null => {
      if (!pointer || !paintingRef.current || store.getSnapshot().painting)
        return null;
      const target = pickRef.current(pointer.x, pointer.y);
      if (!target) return null;
      if ("covered" in target)
        return {
          source: [],
          mirror: [],
          blocked:
            propsRef.current.settings.layer === "base"
              ? [target.covered.y * SKIN_SIZE + target.covered.x]
              : [],
        };
      const { tool, settings: current } = propsRef.current;
      const area = toolFootprint(
        store.pixels,
        store.getSnapshot().variant,
        tool,
        current,
        target.x,
        target.y,
      );
      return area
        ? { ...area, blocked: [] }
        : {
            source: [],
            mirror: [],
            blocked: [target.y * SKIN_SIZE + target.x],
          };
    };
    const sync = () => {
      frameRequest = 0;
      const variant = store.getSnapshot().variant;
      const model = variant === "slim" ? "slim" : "default";
      if (skin.modelType !== model) skin.modelType = model;
      copyFlipped(store.pixels, data);
      // At most one ray cast for each animation frame.
      const overlay = footprint();
      if (overlay) paintOverlay(data, overlay);
      const blocked = !!overlay?.blocked.length;
      if (blocked !== blockedCursor) {
        blockedCursor = blocked;
        canvas.style.cursor = blocked ? "not-allowed" : "";
      }
      texture.needsUpdate = true;
    };
    const request = () => {
      if (!frameRequest) frameRequest = requestAnimationFrame(sync);
    };
    sync();
    const unsubscribe = store.subscribe(request);
    hover.current = {
      move: (x, y) => {
        pointer = { x, y };
        request();
      },
      leave: () => {
        if (!pointer) return;
        pointer = null;
        request();
      },
      refresh: () => {
        if (pointer) request();
      },
    };
    const turned = () => hover.current?.refresh();
    viewer.controls.addEventListener("change", turned);

    const resize = new ResizeObserver(() => {
      if (frame.clientWidth && frame.clientHeight)
        viewer.setSize(frame.clientWidth, frame.clientHeight);
      request();
    });
    resize.observe(frame);

    const lost = (event: Event) => {
      event.preventDefault();
      setFailure(message("editor.graphicsLost"));
    };
    canvas.addEventListener("webglcontextlost", lost);

    return () => {
      hover.current = null;
      pointer = null;
      canvas.style.cursor = "";
      viewer.controls.removeEventListener("change", turned);
      canvas.removeEventListener("webglcontextlost", lost);
      if (frameRequest) cancelAnimationFrame(frameRequest);
      unsubscribe();
      resize.disconnect();
      skin.map = null;
      texture.dispose();
      viewer.dispose();
      viewerRef.current = null;
    };
  }, [store, attempt, propsRef, paintingRef, pickRef]);

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

  // The footprint follows the tool, its settings, and the visible parts.
  useEffect(() => {
    hover.current?.refresh();
  }, [props.tool, settings, painting]);

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

  const coverMessage = () =>
    propsRef.current.settings.layer === "base"
      ? t("editor.outerLayerCoversSpotHideOuterLayer")
      : t("editor.pointOuterLayerVisiblePart");

  const rotate = (angle: number) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.playerWrapper.rotation.y += angle;
    hover.current?.refresh();
  };
  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (viewer)
      viewer.zoom = Math.min(2.5, Math.max(0.4, viewer.zoom * factor));
    hover.current?.refresh();
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.turnModelLeft")}
          disabled={!!failure}
          onClick={() => rotate(-Math.PI / 4)}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.turnModelRight")}
          disabled={!!failure}
          onClick={() => rotate(Math.PI / 4)}
        >
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.zoomModelOut")}
          disabled={!!failure}
          onClick={() => zoom(1 / 1.2)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.zoomModelIn")}
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
            hover.current?.refresh();
          }}
        >
          {t("editor.resetView")}
        </Button>
        <Toggle
          variant="outline"
          size="sm"
          pressed={animate}
          disabled={!!failure}
          onPressedChange={setAnimate}
        >
          {t("editor.walk")}
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
              {t.message(failure)}
            </output>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFailure(null);
                setAttempt((n) => n + 1);
              }}
            >
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : null}
        <canvas
          key={attempt}
          ref={canvasRef}
          hidden={!!failure}
          aria-label={
            painting
              ? t("editor.modelPaintInstructions")
              : t("editor.modelMoveInstructions")
          }
          className={cn("block", painting ? "cursor-crosshair" : "cursor-grab")}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            // Touch has no hover, so a finger never leaves a footprint.
            if (event.pointerType === "touch") hover.current?.leave();
            if (!painting) return;
            if (event.pointerType === "mouse" && event.button !== 0) return;
            if (!event.isPrimary) {
              // A second finger turns the model; drop what the first started.
              tap.current = null;
              store.cancelStroke();
              return;
            }
            const target = pick(event.clientX, event.clientY);
            if (target && "covered" in target) {
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
              line: event.shiftKey,
            });
            if (result === "stroke")
              event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "touch")
              hover.current?.move(event.clientX, event.clientY);
            if (!store.getSnapshot().painting) return;
            const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
            for (const sample of samples.length ? samples : [event]) {
              const target = pick(sample.clientX, sample.clientY);
              if (target && !("covered" in target))
                store.strokeTo(target.x, target.y);
            }
          }}
          onPointerLeave={() => hover.current?.leave()}
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
            ? t("editor.rightDragTwoFingersTurn")
            : t("editor.dragTurnModel")}
        </p>
      )}
    </div>
  );
}
