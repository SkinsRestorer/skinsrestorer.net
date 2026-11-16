"use client";

import { ImageOff, LoaderCircle, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { runHttpEffect } from "@/lib/effect-http";
import type { GalleryState } from "@/lib/hooks/use-skin-gallery";
import { useT } from "@/lib/i18n-react";
import { searchGallery, type GallerySkin } from "@/lib/skin-gallery";
import { loadTextureEffect } from "@/lib/skin-texture";
import { MAX_GALLERY_QUERY } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { SkinThumbnail } from "./skin-thumbnail";

const placeholders = ["gallery-a", "gallery-b", "gallery-c", "gallery-d"];

export function StudioGallery(props: {
  state: GalleryState;
  query: string;
  onQuery: (query: string) => void;
  onRetry: () => void;
  onSelect: (skin: GallerySkin) => void;
  selectedId?: string;
  pendingId?: string;
  layout: "rail" | "drawer";
}) {
  const t = useT();
  const id = useId();
  const { state } = props;
  const skins =
    state.status === "ready" ? searchGallery(state.skins, props.query) : [];
  return (
    <div className="ph-no-capture flex min-w-0 flex-col gap-2.5">
      <Field>
        <FieldLabel htmlFor={id} className="sr-only">
          {t("gallery.searchGallery")}
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            type="search"
            placeholder={t("gallery.search")}
            maxLength={MAX_GALLERY_QUERY}
            value={props.query}
            onChange={(event) => props.onQuery(event.target.value)}
          />
        </InputGroup>
      </Field>
      {state.status === "error" ? (
        <Alert>
          <AlertDescription>
            {t("gallery.galleryCouldNotLoadedTryAgain")}
          </AlertDescription>
          <Button size="sm" variant="outline" onClick={props.onRetry}>
            {t("common.tryAgain")}
          </Button>
        </Alert>
      ) : (
        <>
          <ul
            aria-label={t("gallery.gallerySkins")}
            aria-busy={state.status !== "ready" || undefined}
            className={cn(
              "grid gap-2.5",
              props.layout === "drawer"
                ? "grid-cols-2"
                : "grid-cols-1 lg:grid-cols-2",
            )}
          >
            {state.status !== "ready" &&
              placeholders.map((slot) => (
                <li key={slot} className="flex flex-col gap-1.5">
                  <Skeleton className="aspect-square w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </li>
              ))}
            {skins.map((skin) => (
              // Offscreen entries skip layout and paint until scrolled near.
              <li
                key={skin.id}
                className="min-w-0 [contain-intrinsic-block-size:auto_8rem] [content-visibility:auto]"
              >
                <button
                  type="button"
                  aria-current={props.selectedId === skin.id || undefined}
                  aria-busy={props.pendingId === skin.id || undefined}
                  aria-label={t("gallery.nameModelModel", {
                    name: skin.name,
                    model: t(
                      skin.variant === "slim" ? "model.slim" : "model.classic",
                    ),
                  })}
                  title={skin.name}
                  onClick={() => props.onSelect(skin)}
                  className="group flex w-full min-w-0 flex-col gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "relative grid aspect-square w-full place-items-center rounded-lg border bg-muted",
                      props.selectedId === skin.id
                        ? "border-foreground"
                        : "border-transparent group-hover:border-foreground/35",
                    )}
                  >
                    <GalleryThumbnail skin={skin} />
                    {props.pendingId === skin.id && (
                      <LoaderCircle
                        aria-label={t("gallery.openingSkin")}
                        className="absolute right-1 bottom-1 size-4 animate-spin"
                      />
                    )}
                  </span>
                  <span className="w-full truncate text-xs">{skin.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {state.status === "ready" && skins.length === 0 && (
            <output
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {t("gallery.noSkinsFound")}
            </output>
          )}
        </>
      )}
    </div>
  );
}

const onVisible = new WeakMap<Element, () => void>();
let visibility: IntersectionObserver | undefined;

/**
 * Call `show` once when `element` comes near the viewport. All thumbnails
 * share one observer: the gallery mounts dozens at once, and each observer
 * adds setup work to the frame that shows the gallery.
 */
function whenVisible(element: Element, show: () => void) {
  visibility ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        visibility?.unobserve(entry.target);
        onVisible.get(entry.target)?.();
        onVisible.delete(entry.target);
      }
    },
    { rootMargin: "80px" },
  );
  onVisible.set(element, show);
  visibility.observe(element);
  return () => {
    visibility?.unobserve(element);
    onVisible.delete(element);
  };
}

/** Offscreen catalog entries do not download a PNG or decode a thumbnail. */
function GalleryThumbnail({ skin }: { skin: GallerySkin }) {
  const t = useT();
  const frame = useRef<HTMLSpanElement>(null);
  const [png, setPng] = useState<Blob>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const controller = new AbortController();
    const stop = whenVisible(element, () => {
      void runHttpEffect(
        loadTextureEffect(skin.textureUrl),
        controller.signal,
      ).then(
        (result) => {
          if (!controller.signal.aborted)
            setPng(
              new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
                type: "image/png",
              }),
            );
        },
        () => {
          if (!controller.signal.aborted) setFailed(true);
        },
      );
    });
    return () => {
      stop();
      controller.abort();
    };
  }, [skin.textureUrl]);
  return (
    <span ref={frame} className="grid size-full place-items-center">
      {png ? (
        <SkinThumbnail
          png={png}
          variant={skin.variant}
          view="bust"
          className="w-[64%]"
        />
      ) : failed ? (
        <ImageOff
          className="size-4 text-muted-foreground"
          aria-label={t("gallery.previewUnavailable")}
        />
      ) : (
        <Skeleton className="size-3/4" />
      )}
    </span>
  );
}
