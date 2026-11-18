"use client";

import { useEffect, useState } from "react";
import { runHttpEffect } from "../effect-http";
import { loadGalleryEffect, type GallerySkin } from "../skin-gallery";
import { useLatestTask } from "./use-latest-task";

export type GalleryState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly skins: readonly GallerySkin[] }
  | { readonly status: "error" };

/**
 * The parsed catalog for this page load. Studio can unmount and mount again
 * during client navigation, and the catalog does not change in that time.
 */
let loadedCatalog: readonly GallerySkin[] | undefined;
const loading: GalleryState = { status: "loading" };

/** One catalog per visit, fetched only for Gallery or an explicit skin link. */
export function useSkinGallery(enabled: boolean) {
  // "idle" here means no result yet. While enabled, callers see "loading".
  const [state, setState] = useState<GalleryState>(() =>
    loadedCatalog
      ? { status: "ready", skins: loadedCatalog }
      : { status: "idle" },
  );
  const task = useLatestTask();
  const status = state.status;
  useEffect(() => {
    if (!enabled || status !== "idle") return undefined;
    void task.run(
      (signal) => runHttpEffect(loadGalleryEffect(), signal),
      (skins) => {
        loadedCatalog = skins;
        setState({ status: "ready", skins });
      },
      () => setState({ status: "error" }),
    );
    return () => task.cancel();
  }, [enabled, status, task]);
  const retry = () => setState({ status: "idle" });
  const failed = enabled && status === "error";
  useEffect(() => {
    if (!failed) return undefined;
    // A read is safe to repeat, so a restored connection loads it again.
    const reload = () => setState({ status: "idle" });
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, [failed]);
  return {
    state: enabled && status === "idle" ? loading : state,
    retry,
  };
}
