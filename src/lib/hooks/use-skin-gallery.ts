"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useEffect, useMemo } from "react";
import { httpClientLayer } from "../effect-http";
import { loadGalleryEffect, type GallerySkin } from "../skin-gallery";

export type GalleryState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly skins: readonly GallerySkin[] }
  | { readonly status: "error" };

/**
 * The parsed catalog for this page load. Studio can unmount and mount again
 * during client navigation, and the catalog does not change in that time.
 */
let loadedCatalog: readonly GallerySkin[] | undefined;

/**
 * Loads while Gallery or a skin link reads it. Closing both interrupts the
 * download, and a failed load starts again on the next read. The server
 * renders the loading state and never downloads.
 */
const galleryAtom = Atom.make(
  Effect.suspend(() =>
    loadedCatalog
      ? Effect.succeed(loadedCatalog)
      : loadGalleryEffect().pipe(
          Effect.provide(httpClientLayer),
          Effect.tap((skins) =>
            Effect.sync(() => {
              loadedCatalog = skins;
            }),
          ),
        ),
  ),
).pipe(Atom.withServerValueInitial);

type GalleryResult = AsyncResult.AsyncResult<readonly GallerySkin[], unknown>;

const disabledAtom = Atom.readable((): GalleryResult => AsyncResult.initial());

const loading: GalleryState = { status: "loading" };
const idle: GalleryState = { status: "idle" };

/** One catalog per visit, fetched only for Gallery or an explicit skin link. */
export function useSkinGallery(enabled: boolean) {
  const atom: Atom.Atom<GalleryResult> = enabled ? galleryAtom : disabledAtom;
  const result = useAtomValue(atom);
  const retry = useAtomRefresh(atom);
  const failed = AsyncResult.isFailure(result) && !result.waiting;
  useEffect((): (() => void) | undefined => {
    if (!failed) return undefined;
    // A read is safe to repeat, so a restored connection loads it again.
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("online", retry);
    };
  }, [failed, retry]);

  // Callers compare the state between renders, so it changes only with the
  // result.
  const state = useMemo((): GalleryState => {
    if (AsyncResult.isSuccess(result))
      return { status: "ready", skins: result.value };
    if (AsyncResult.isFailure(result) && !result.waiting)
      return { status: "error" };
    if (enabled) return loading;
    return loadedCatalog ? { status: "ready", skins: loadedCatalog } : idle;
  }, [enabled, result]);
  return { state, retry };
}
