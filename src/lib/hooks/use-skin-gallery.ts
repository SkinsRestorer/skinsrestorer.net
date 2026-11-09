"use client";

import { useEffect, useRef, useState } from "react";
import { runHttpEffect } from "../effect-http";
import { loadGalleryEffect, type GallerySkin } from "../skin-gallery";
import { useLatestTask } from "./use-latest-task";

export type GalleryState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "ready"; readonly skins: readonly GallerySkin[] }
  | { readonly status: "error" };

/** One catalog per visit, fetched only for Gallery or an explicit skin link. */
export function useSkinGallery(enabled: boolean) {
  const [state, setState] = useState<GalleryState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const loaded = useRef(false);
  const task = useLatestTask();
  useEffect(() => {
    if (!enabled || loaded.current) return;
    setState({ status: "loading" });
    void task.run(
      (signal) => runHttpEffect(loadGalleryEffect(), signal),
      (skins) => {
        loaded.current = true;
        setState({ status: "ready", skins });
      },
      () => setState({ status: "error" }),
    );
    return () => task.cancel();
  }, [enabled, attempt, task]);
  return { state, retry: () => setAttempt((value) => value + 1) };
}
