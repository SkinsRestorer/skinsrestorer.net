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
  const handleFileChange = useCallback(
    (nextFile: File | null) => {
      detection.cancel();
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
      setFile(nextFile);
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
                setSkinType(variant);
                toast.success(`Skin file detected as a ${variant} skin.`, {
                  id,
                });
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
