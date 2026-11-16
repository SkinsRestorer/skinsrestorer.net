"use client";

import { ImageOff, LoaderCircle, Search } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
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
import { loadTexturePreviewEffect } from "@/lib/skin-texture";
import { MAX_GALLERY_QUERY } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { SkinThumbnail } from "./skin-thumbnail";

const placeholders = ["gallery-a", "gallery-b", "gallery-c", "gallery-d"];

/** The item index an arrow, Home, or End key moves to in a grid. */
export function galleryKeyTarget(
  key: string,
  index: number,
  count: number,
  columns: number,
): number | undefined {
  const target =
    key === "ArrowRight"
      ? index + 1
      : key === "ArrowLeft"
        ? index - 1
        : key === "ArrowDown"
          ? index + columns
          : key === "ArrowUp"
            ? index - columns
            : key === "Home"
              ? 0
              : key === "End"
                ? count - 1
                : undefined;
  if (target === undefined || target < 0 || target >= count) return;
  return target;
}

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
  const list = useRef<HTMLUListElement>(null);
  const [focusedId, setFocusedId] = useState<string>();
  const skins =
    state.status === "ready" ? searchGallery(state.skins, props.query) : [];
  // One Tab stop for the whole grid. Arrow keys move between entries.
  const tabStop =
    [focusedId, props.selectedId].find(
      (candidate) => candidate && skins.some((skin) => skin.id === candidate),
    ) ?? skins[0]?.id;
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const element = list.current;
    if (!element || event.altKey || event.ctrlKey || event.metaKey) return;
    const buttons = [
      ...element.querySelectorAll<HTMLButtonElement>("button[data-skin-id]"),
    ];
    const index = buttons.indexOf(event.currentTarget);
    if (index < 0) return;
    const columns = getComputedStyle(element)
      .gridTemplateColumns.split(" ")
      .filter(Boolean).length;
    const target = galleryKeyTarget(
      event.key,
      index,
      buttons.length,
      Math.max(1, columns),
    );
    if (target === undefined) return;
    event.preventDefault();
    buttons[target].focus();
  };
  const empty = state.status === "ready" && skins.length === 0;
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
            ref={list}
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
            {skins.map((skin) => {
              const selected = props.selectedId === skin.id;
              const pending = props.pendingId === skin.id;
              return (
                // Offscreen entries skip layout and paint until scrolled near.
                <li
                  key={skin.id}
                  className="min-w-0 [contain-intrinsic-block-size:auto_8rem] [content-visibility:auto]"
                >
                  <button
                    type="button"
                    data-skin-id={skin.id}
                    tabIndex={skin.id === tabStop ? 0 : -1}
                    aria-current={selected || undefined}
                    aria-busy={pending || undefined}
                    aria-label={t("gallery.nameModelModel", {
                      name: skin.name,
                      model: t(
                        skin.variant === "slim"
                          ? "model.slim"
                          : "model.classic",
                      ),
                    })}
                    title={skin.name}
                    onFocus={() => setFocusedId(skin.id)}
                    onKeyDown={moveFocus}
                    onClick={() => props.onSelect(skin)}
                    className="group flex w-full min-w-0 flex-col gap-1.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span
                      className={cn(
                        "relative grid aspect-square w-full place-items-center rounded-lg border bg-muted",
                        selected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent group-hover:border-foreground/35",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-full place-items-center transition-opacity",
                          pending && "opacity-50",
                        )}
                      >
                        <GalleryThumbnail skin={skin} />
                      </span>
                      {pending && (
                        <LoaderCircle
                          aria-label={t("gallery.openingSkin")}
                          className="absolute inset-0 m-auto size-5 animate-spin"
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "w-full truncate text-xs",
                        selected && "font-medium",
                      )}
                    >
                      {skin.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Stays mounted, so screen readers announce a change to no results. */}
          <output aria-live="polite" className="text-xs text-muted-foreground">
            {empty && t("gallery.noSkinsFound")}
          </output>
          {empty && props.query.trim() !== "" && (
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => props.onQuery("")}
            >
              {t("gallery.clearSearch")}
            </Button>
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

/**
 * Thumbnail PNGs for this page load, so reopening Gallery draws at once. The
 * catalog holds at most 1000 entries, and each PNG is a few kilobytes.
 */
const thumbnails = new Map<string, Blob>();

/** Offscreen catalog entries do not download a PNG or decode a thumbnail. */
function GalleryThumbnail({ skin }: { skin: GallerySkin }) {
  const t = useT();
  const frame = useRef<HTMLSpanElement>(null);
  const [png, setPng] = useState(() => thumbnails.get(skin.textureUrl));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const element = frame.current;
    if (!element || thumbnails.has(skin.textureUrl)) return;
    const controller = new AbortController();
    const stop = whenVisible(element, () => {
      void runHttpEffect(
        loadTexturePreviewEffect(skin.textureUrl),
        controller.signal,
      ).then(
        (blob) => {
          if (controller.signal.aborted) return;
          thumbnails.set(skin.textureUrl, blob);
          setPng(blob);
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
  }, [skin.textureUrl, attempt]);
  useEffect(() => {
    if (!failed) return;
    // Previews that failed while offline load again once the connection returns.
    const retry = () => {
      setFailed(false);
      setAttempt((value) => value + 1);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [failed]);
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
