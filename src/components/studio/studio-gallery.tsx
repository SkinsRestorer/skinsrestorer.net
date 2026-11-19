"use client";

import { ImageOff, LoaderCircle, Search } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { galleryKeyTarget } from "./gallery-keys";
import { SkinThumbnail } from "./skin-thumbnail";

const placeholders = ["gallery-a", "gallery-b", "gallery-c", "gallery-d"];

export function StudioGallery(props: {
  state: GalleryState;
  query: string;
  onQuery: (query: string) => void;
  onRetry: () => void;
  onSelect: (skin: GallerySkin) => void;
  selectedId?: string | undefined;
  pendingId?: string | undefined;
  layout: "rail" | "drawer";
}) {
  const t = useT();
  const id = useId();
  const { state } = props;
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
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
    buttons[target]?.focus();
  };
  const empty = state.status === "ready" && skins.length === 0;
  return (
    <div className="flex min-w-0 flex-col gap-2.5 ph-no-capture">
      <Field>
        <FieldLabel htmlFor={id} className="sr-only">
          {t("gallery.searchGallery")}
        </FieldLabel>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={search}
            id={id}
            type="search"
            placeholder={t("gallery.search")}
            maxLength={MAX_GALLERY_QUERY}
            value={props.query}
            onChange={(event) => {
              props.onQuery(event.target.value);
            }}
          />
        </InputGroup>
      </Field>
      {state.status === "error" ? (
        <Alert>
          <AlertDescription>
            {t("gallery.galleryCouldNotLoadedTryAgain")}
          </AlertDescription>
          {/* The alert unmounts on retry, so focus moves to the search. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              props.onRetry();
              search.current?.focus();
            }}
          >
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
                    onFocus={() => {
                      setFocusedId(skin.id);
                    }}
                    onKeyDown={moveFocus}
                    onClick={() => {
                      props.onSelect(skin);
                    }}
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
              onClick={() => {
                props.onQuery("");
                // This button unmounts with the empty result. Keep focus nearby.
                search.current?.focus();
              }}
            >
              {t("gallery.clearSearch")}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

const onVisibility = new WeakMap<Element, (visible: boolean) => void>();
let visibility: IntersectionObserver | undefined;

/**
 * Report when `element` comes near the viewport and when it leaves. All
 * thumbnails share one observer: the gallery mounts dozens at once, and each
 * observer adds setup work to the frame that shows the gallery.
 */
function watchVisibility(
  element: Element,
  onChange: (visible: boolean) => void,
) {
  visibility ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        onVisibility.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: "80px" },
  );
  onVisibility.set(element, onChange);
  visibility.observe(element);
  return () => {
    visibility?.unobserve(element);
    onVisibility.delete(element);
  };
}

/**
 * Thumbnail PNGs for this page load, so reopening Gallery draws at once. The
 * catalog holds at most 1000 entries, and each PNG is a few kilobytes.
 */
const thumbnails = new Map<string, Blob>();
const thumbnailListeners = new Set<() => void>();

function subscribeThumbnails(listener: () => void) {
  thumbnailListeners.add(listener);
  return () => {
    thumbnailListeners.delete(listener);
  };
}

function storeThumbnail(textureUrl: string, png: Blob) {
  thumbnails.set(textureUrl, png);
  for (const listener of thumbnailListeners) listener();
}

/** Offscreen catalog entries do not download a PNG or decode a thumbnail. */
function GalleryThumbnail({ skin }: { skin: GallerySkin }) {
  const t = useT();
  const frame = useRef<HTMLSpanElement>(null);
  // Another entry with the same texture may load it first.
  const png = useSyncExternalStore(
    subscribeThumbnails,
    () => thumbnails.get(skin.textureUrl),
    (): undefined => undefined,
  );
  const [failed, setFailed] = useState(false);
  useEffect((): (() => void) | undefined => {
    if (png || failed) return undefined;
    const element = frame.current;
    if (!element) return undefined;
    let controller: AbortController | undefined;
    const stop = watchVisibility(element, (visible) => {
      if (!visible) {
        // Scrolled past before it loaded: free the download slot for the
        // entries on screen now. It loads again when it comes back.
        controller?.abort();
        controller = undefined;
        return;
      }
      if (controller) return;
      const current = new AbortController();
      controller = current;
      void runHttpEffect(
        loadTexturePreviewEffect(skin.textureUrl),
        current.signal,
      ).then(
        (blob) => {
          if (current.signal.aborted) return;
          stop();
          storeThumbnail(skin.textureUrl, blob);
        },
        () => {
          if (current.signal.aborted) return;
          stop();
          setFailed(true);
        },
      );
    });
    return () => {
      stop();
      controller?.abort();
    };
  }, [skin.textureUrl, png, failed]);
  useEffect((): (() => void) | undefined => {
    if (!failed) return undefined;
    // Previews that failed while offline load again once the connection returns.
    const retry = () => {
      setFailed(false);
    };
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("online", retry);
    };
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
