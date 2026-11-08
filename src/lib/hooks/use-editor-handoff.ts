"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAsRef } from "@/hooks/use-as-ref";
import type { SkinVariant } from "../skin";
import { browserStorage, readHandoff } from "../skin-draft";
import { useLatestTask } from "./use-latest-task";

/**
 * Fill a skin form with the PNG the editor handed off. The page only selects
 * the file; it uploads nothing until the user presses its own button.
 */
export function useEditorHandoff(
  handoffId: string | undefined,
  select: (file: File, variant: SkinVariant) => void,
) {
  const task = useLatestTask();
  const selectRef = useAsRef(select);
  const [file, setFile] = useState<File | undefined>();
  useEffect(() => {
    if (!handoffId) return;
    void task.run(
      () => readHandoff(browserStorage("sessionStorage"), handoffId),
      (handoff) => {
        if (!handoff) {
          toast.error(
            "The skin from the editor is no longer available. Open the editor and choose the handoff again.",
          );
          return;
        }
        setFile(handoff.file);
        selectRef.current(handoff.file, handoff.variant);
      },
      () => toast.error("The skin from the editor could not be read."),
    );
  }, [handoffId, task, selectRef]);
  return file;
}
