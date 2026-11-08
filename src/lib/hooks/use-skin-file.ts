"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  previewSkinFileEffect,
  runSkinEffect,
  type SkinVariant,
} from "@/lib/skin";
import { useLatestTask } from "./use-latest-task";

export function useSkinFile() {
  const detection = useLatestTask();
  const notification = useRef<string | number | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [skinUrl, setSkinUrl] = useState<string | null>(null);
  const [skinType, setSkinType] = useState<SkinVariant>("classic");
  useEffect(
    () => () => {
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
    },
    [],
  );
  /**
   * Select a file and detect its model. An explicit model, such as one chosen
   * in the skin editor, replaces the detected model when detection finishes.
   */
  const handleFileChange = useCallback(
    (nextFile: File | null, explicitVariant?: SkinVariant) => {
      detection.cancel();
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
      setFile(null);
      setSkinUrl(null);
      if (!nextFile) return;
      const id = toast.loading("Detecting skin type...");
      notification.current = id;
      const failed = (cause: unknown) =>
        toast.error(
          `Failed to detect skin type: ${cause instanceof Error ? cause.message : String(cause)}`,
          { id },
        );
      void detection.run(
        (signal) =>
          runSkinEffect(
            previewSkinFileEffect(nextFile, {
              preview: setSkinUrl,
              detected: (variant) => {
                setFile(nextFile);
                setSkinType(explicitVariant ?? variant);
                toast.success(
                  explicitVariant
                    ? `Skin from the editor loaded as a ${explicitVariant} skin.`
                    : `Skin file detected as a ${variant} skin.`,
                  { id },
                );
              },
              failed,
            }),
            signal,
          ),
        () => undefined,
        failed,
      );
    },
    [detection],
  );
  return { file, skinUrl, skinType, setSkinType, handleFileChange };
}
