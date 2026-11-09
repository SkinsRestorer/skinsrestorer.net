"use client";

import { ImageOff, LoaderCircle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { runHttpEffect } from "@/lib/effect-http";
import type { GalleryState } from "@/lib/hooks/use-skin-gallery";
import { useT } from "@/lib/i18n-react";
import { searchGallery, type GallerySkin } from "@/lib/skin-gallery";
import { loadTextureEffect } from "@/lib/skin-texture";
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
          {t("Search gallery")}
        </FieldLabel>
        <Input
          id={id}
          type="search"
          placeholder={t("Search")}
          value={props.query}
          onChange={(event) => props.onQuery(event.target.value)}
        />
      </Field>
      {state.status === "error" ? (
        <Alert>
          <AlertDescription>
            {t("The gallery could not be loaded. Try again.")}
          </AlertDescription>
          <Button size="sm" variant="outline" onClick={props.onRetry}>
            {t("Try again")}
          </Button>
        </Alert>
      ) : (
        <>
          <ul
            aria-label={t("Gallery skins")}
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
                <li key={slot}>
                  <Skeleton className="aspect-square w-full" />
                </li>
              ))}
            {skins.map((skin) => (
              <li key={skin.id} className="min-w-0">
                <button
                  type="button"
                  aria-current={props.selectedId === skin.id || undefined}
                  aria-label={t("{name}, {model} model", {
                    name: skin.name,
                    model: t(skin.variant === "slim" ? "Slim" : "Classic"),
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
                        aria-label={t("Opening skin")}
                        className="absolute right-1 bottom-1 size-4 animate-spin"
                      />
                    )}
                  </span>
                  <span className="w-full truncate text-xs" title={skin.name}>
                    {skin.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {state.status === "ready" && skins.length === 0 && (
            <output
              className="text-xs text-muted-foreground"
              aria-live="polite"
            >
              {t("No skins found.")}
            </output>
          )}
        </>
      )}
    </div>
  );
}

/** Offscreen catalog entries do not download a PNG or decode a thumbnail. */
function GalleryThumbnail({ skin }: { skin: GallerySkin }) {
  const t = useT();
  const frame = useRef<HTMLSpanElement>(null);
  const [png, setPng] = useState<Blob>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
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
      },
      { rootMargin: "80px" },
    );
    if (frame.current) observer.observe(frame.current);
    return () => {
      observer.disconnect();
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
          aria-label={t("Preview unavailable")}
        />
      ) : (
        <Skeleton className="size-3/4" />
      )}
    </span>
  );
}
