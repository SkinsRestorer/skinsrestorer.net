"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { previewSkinFileEffect, runSkinEffect } from "../skin";
import { browserLibrary } from "../skin-library-client";
import { SkinSelectionStore } from "../skin-selection";

/**
 * The selected skin of an Upload or Generator form. Selecting shows the skin
 * at once; keeping it in this browser happens in the background.
 */
export function useSkinSelection() {
  const [notification] = useState<{ current?: string | number }>(() => ({}));
  const [store] = useState(() => {
    const dismiss = () => {
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
      notification.current = undefined;
    };
    return new SkinSelectionStore({
      library: browserLibrary(),
      preview: (file, events, signal) =>
        runSkinEffect(previewSkinFileEffect(file, events), signal),
      events: {
        checking: () => {
          dismiss();
          notification.current = toast.loading("Detecting skin type...");
        },
        detected: (_token, variant, origin) => {
          const id = notification.current;
          notification.current = undefined;
          toast.success(
            origin === "file"
              ? `Skin file detected as a ${variant} skin.`
              : origin === "library"
                ? `Saved skin loaded as a ${variant} skin.`
                : `Skin from the editor loaded as a ${variant} skin.`,
            { id },
          );
        },
        failed: (_token, message) => {
          const id = notification.current;
          notification.current = undefined;
          toast.error(`Failed to detect skin type: ${message}`, { id });
        },
        imported: (kept, failed) => {
          toast.info(
            `${kept} skins kept in this browser. The first one is selected.`,
            failed
              ? {
                  description: `${failed} ${failed === 1 ? "file was" : "files were"} not a skin PNG.`,
                }
              : undefined,
          );
        },
      },
    });
  });
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.connect(), [store]);
  useEffect(
    () => () => {
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
    },
    [notification],
  );
  const selection = state.selection;
  return {
    store,
    state,
    /** The file to send, once its dimensions are checked. */
    file: selection?.status === "ready" ? selection.file : null,
  };
}
