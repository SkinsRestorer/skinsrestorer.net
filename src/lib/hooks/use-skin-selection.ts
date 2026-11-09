"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useNotificationT } from "@/lib/i18n-react";
import { toast } from "sonner";
import { previewSkinFileEffect, runSkinEffect } from "../skin";
import { browserLibrary } from "../skin-library-client";
import { SkinSelectionStore } from "../skin-selection";

/**
 * The selected skin of an Upload or Generator form. Selecting shows the skin
 * at once; keeping it in this browser happens in the background. The model
 * selector shows the detected model, so only failures are announced.
 */
export function useSkinSelection() {
  const t = useNotificationT();
  const [store] = useState(
    () =>
      new SkinSelectionStore({
        library: browserLibrary(),
        preview: (file, events, signal) =>
          runSkinEffect(previewSkinFileEffect(file, events), signal),
        events: {
          failed: (_token, message) =>
            toast.error(
              t("common.failedDetectSkinTypeError", {
                error: t.message(message),
              }),
            ),
          imported: (kept, failed) =>
            toast.info(
              t("common.addedCountSkinsFirstOneSelected", {
                count: kept,
              }),
              failed
                ? {
                    description: t("common.countFilesWereNotSkinPngs", {
                      count: failed,
                    }),
                  }
                : undefined,
            ),
        },
      }),
  );
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.connect(), [store]);
  const selection = state.selection;
  return {
    store,
    state,
    /** The file to send, once its dimensions are checked. */
    file: selection?.status === "ready" ? selection.file : null,
  };
}
