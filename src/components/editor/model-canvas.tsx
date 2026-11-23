"use client";

import { message, type Message } from "@/lib/messages";

import { Box, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  type Object3D,
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
import { releaseSkinViewer } from "@/lib/release-skin-viewer";
import {
  startTool,
  type EditorSurfaceProps,
} from "@/components/editor/editor-types";
import { useT } from "@/lib/i18n-react";
import {
  copyFlipped,
  paintOverlay,
  type HoverOverlay,
} from "@/components/editor/model-overlay";

interface PaintTarget {
  readonly x: number;
  readonly y: number;
  readonly color: readonly [number, number, number, number];
}

/** An outer-layer pixel that hides the base pixel under the pointer. */
interface Covered {
  readonly covered: { readonly x: number; readonly y: number };
}

/** Ray-cast state, made once for each viewer. */
interface Picker {
  readonly raycaster: Raycaster;
  readonly pointer: Vector2;
  readonly owners: Map<Object3D, { part: SkinPart; layer: SkinLayer }>;
  readonly meshes: Object3D[];
}

/** The canvas position for the samples of one pointer event. */
type PickFrame = DOMRect;

/**
 * The live 3D model. skinview3d draws the model; the editor owns the texture.
 * The texture reads the document pixels directly, so the preview never
 * changes them (loadSkin would clear hat pixels on opaque skins).
 */
export function ModelCanvas(
  props: EditorSurfaceProps & {
    readonly frameClassName?: string;
    /** Extra controls at the end of the view toolbar. */
    readonly actions?: ReactNode;
  },
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
  const pickerRef = useRef<Picker | null>(null);
  /** A fill or pick that waits for the finger to lift, as a tap. */
  const tap = useRef<{ id: number; target: PaintTarget } | null>(null);
  /** The pointer that paints the current stroke. Others cannot move it. */
  const strokePointer = useRef<{ id: number; touch: boolean } | null>(null);
  /**
   * Moves the hover footprint. Set while a viewer exists. The model is drawn
   * on demand, so every change to the view must call `redraw`.
   */
  const hover = useRef<{
    move: (clientX: number, clientY: number) => void;
    leave: () => void;
    /** Redraw the footprint, if the pointer is over the model. */
    refresh: () => void;
    redraw: () => void;
  } | null>(null);
  const painting = interaction === "paint" && !animate;
  const paintingRef = useAsRef(painting);

  /**
   * Prepare the picks of one pointer event: update the model matrices and
   * read the canvas position once, not for each coalesced sample.
   */
  const pickFrame = (): PickFrame | undefined => {
    const viewer = viewerRef.current;
    const canvas = canvasRef.current;
    if (!viewer || !canvas) return undefined;
    viewer.scene.updateMatrixWorld(true);
    return canvas.getBoundingClientRect();
  };

  /**
   * The pixel under the pointer on the active layer, if nothing covers it.
   * To pick a color, the pixel the eye sees on any layer.
   */
  const pick = (
    frame: PickFrame | undefined,
    clientX: number,
    clientY: number,
    picking = propsRef.current.tool === "eyedropper",
  ): PaintTarget | Covered | undefined => {
    const viewer = viewerRef.current;
    const picker = pickerRef.current;
    if (!viewer || !picker || !frame) return undefined;
    const { raycaster, pointer, owners, meshes } = picker;
    pointer.set(
      ((clientX - frame.left) / frame.width) * 2 - 1,
      -((clientY - frame.top) / frame.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, viewer.camera);
    const { variant } = store.getSnapshot();
    for (const hit of raycaster.intersectObjects(meshes, false)) {
      // The ray cast does not check visibility; hidden layers let it pass.
      if (!hit.object.visible) continue;
      const owner = owners.get(hit.object);
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
      const { settings: current } = propsRef.current;
      if (picking) {
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
  const pickFrameRef = useAsRef(pickFrame);

  useEffect((): (() => void) | undefined => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return undefined;
    let viewer: SkinViewer;
    try {
      viewer = new SkinViewer({
        canvas,
        width: frame.clientWidth || 300,
        height: frame.clientHeight || 360,
        zoom: 0.8,
        enableControls: true,
        // Draw on demand. A loop that redraws every frame keeps the main
        // thread and GPU busy while nothing moves.
        renderPaused: true,
      });
    } catch {
      // oxlint-disable-next-line react-hooks-js/set-state-in-effect -- Report failure to initialize the external WebGL viewer.
      setFailure(message("editor.webglUnavailable"));
      return undefined;
    }
    viewerRef.current = viewer;
    const owners = new Map<Object3D, { part: SkinPart; layer: SkinLayer }>();
    for (const part of skinParts) {
      const bodyPart = viewer.playerObject.skin[part];
      owners.set(bodyPart.innerLayer, { part, layer: "base" });
      owners.set(bodyPart.outerLayer, { part, layer: "outer" });
    }
    pickerRef.current = {
      raycaster: new Raycaster(),
      pointer: new Vector2(),
      owners,
      meshes: [...owners.keys()],
    };
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
      const target = pickRef.current(
        pickFrameRef.current(),
        pointer.x,
        pointer.y,
      );
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
      // While the walk animation plays, skinview3d's own loop draws.
      if (viewer.renderPaused) viewer.render();
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
      redraw: request,
    };
    viewer.controls.addEventListener("change", request);
    // Browser zoom or a move to another screen resizes the drawing buffer,
    // which clears it.
    window.addEventListener("resize", request);

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
      viewer.controls.removeEventListener("change", request);
      window.removeEventListener("resize", request);
      canvas.removeEventListener("webglcontextlost", lost);
      if (frameRequest) cancelAnimationFrame(frameRequest);
      unsubscribe();
      resize.disconnect();
      skin.map = null;
      texture.dispose();
      releaseSkinViewer(viewer);
      viewerRef.current = null;
      pickerRef.current = null;
    };
  }, [store, attempt, propsRef, paintingRef, pickRef, pickFrameRef]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const part of skinParts) {
      viewer.playerObject.skin[part].innerLayer.visible =
        settings.visibility[part].base;
      viewer.playerObject.skin[part].outerLayer.visible =
        settings.visibility[part].outer;
    }
    hover.current?.redraw();
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
    viewer.renderPaused = !animate;
    if (!animate) {
      viewer.playerObject.resetJoints();
      hover.current?.redraw();
    }
  }, [painting, animate, attempt, failure]);

  const cancelStroke = () => {
    strokePointer.current = null;
    store.cancelStroke();
  };

  const coverMessage = () =>
    propsRef.current.settings.layer === "base"
      ? t("editor.outerLayerCoversSpotHideOuterLayer")
      : t("editor.pointOuterLayerVisiblePart");

  const rotate = (angle: number) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.playerWrapper.rotation.y += angle;
    hover.current?.redraw();
  };
  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (viewer)
      viewer.zoom = Math.min(2.5, Math.max(0.4, viewer.zoom * factor));
    hover.current?.redraw();
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.turnModelLeft")}
          disabled={!!failure}
          onClick={() => {
            rotate(-Math.PI / 4);
          }}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.turnModelRight")}
          disabled={!!failure}
          onClick={() => {
            rotate(Math.PI / 4);
          }}
        >
          <RotateCw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.zoomModelOut")}
          disabled={!!failure}
          onClick={() => {
            zoom(1 / 1.2);
          }}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("editor.zoomModelIn")}
          disabled={!!failure}
          onClick={() => {
            zoom(1.2);
          }}
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
            hover.current?.redraw();
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
        {props.actions}
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
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The model is drawn on a WebGL canvas, so it cannot be an <img>.
          role="img"
          aria-label={
            painting
              ? t("editor.modelPaintInstructions")
              : t("editor.modelMoveInstructions")
          }
          className={cn(
            "block",
            painting
              ? "cursor-crosshair"
              : "cursor-grab active:cursor-grabbing",
          )}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
          onPointerDown={(event) => {
            // Touch has no hover, so a finger never leaves a footprint.
            if (event.pointerType === "touch") hover.current?.leave();
            if (!painting) return;
            const touch = event.pointerType === "touch";
            const owner = strokePointer.current;
            if (owner && owner.id !== event.pointerId) {
              // A second finger turns the model; drop what the first started.
              // A palm that touches during a pen or mouse stroke is ignored.
              if (owner.touch && touch) cancelStroke();
              return;
            }
            if (!event.isPrimary) {
              tap.current = null;
              cancelStroke();
              return;
            }
            // Only the main button paints. A pen's barrel button turns the
            // model, and its eraser end does nothing here.
            if (!touch && event.button !== 0) return;
            const target = pick(
              pickFrame(),
              event.clientX,
              event.clientY,
              event.altKey || propsRef.current.tool === "eyedropper",
            );
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
              pick: event.altKey,
            });
            if (result === "stroke") {
              strokePointer.current = { id: event.pointerId, touch };
              event.currentTarget.setPointerCapture(event.pointerId);
            }
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== "touch")
              hover.current?.move(event.clientX, event.clientY);
            if (strokePointer.current?.id !== event.pointerId) return;
            if (!store.getSnapshot().painting) return;
            // Older Safari versions lack getCoalescedEvents.
            const native = event.nativeEvent;
            const samples =
              "getCoalescedEvents" in native ? native.getCoalescedEvents() : [];
            const frame = pickFrame();
            for (const sample of samples.length > 0 ? samples : [event]) {
              const target = pick(frame, sample.clientX, sample.clientY);
              // Off the model or on a covered spot, the stroke lifts, so it
              // does not draw a line across the gap when it comes back.
              if (target && !("covered" in target))
                store.strokeTo(target.x, target.y);
              else store.liftStroke();
            }
          }}
          onPointerLeave={() => hover.current?.leave()}
          onPointerUp={(event) => {
            const owner = strokePointer.current;
            if (owner && owner.id !== event.pointerId) return;
            strokePointer.current = null;
            const pending = tap.current;
            tap.current = null;
            if (pending?.id === event.pointerId) {
              startTool(propsRef.current, pending.target.x, pending.target.y, {
                surfaceLock: true,
                pickColor: pending.target.color,
              });
              return;
            }
            if (store.endStroke()) propsRef.current.onPainted();
          }}
          onPointerCancel={(event) => {
            const owner = strokePointer.current;
            if (owner && owner.id !== event.pointerId) return;
            tap.current = null;
            cancelStroke();
          }}
          onLostPointerCapture={(event) => {
            // The canvas lost the pointer without a pointer up, for example
            // when it was hidden. Keep what the stroke painted.
            if (strokePointer.current?.id !== event.pointerId) return;
            strokePointer.current = null;
            if (store.endStroke()) propsRef.current.onPainted();
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
