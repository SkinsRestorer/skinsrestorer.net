import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  uploadMineSkinFile,
  type MineSkinCompletedResponse,
  type MineSkinUploadOptions,
} from "../mineskin";
import { useLatestTask } from "./use-latest-task";

/** Upload callbacks share the component lifetime; a cancelled upload is never replayed. */
export function useSkinUpload() {
  const task = useLatestTask();
  const [loading, setLoading] = useState(false);
  const notification = useRef<string | number | undefined>(undefined);
  useEffect(
    () => () => {
      if (notification.current !== undefined)
        toast.dismiss(notification.current);
    },
    [],
  );
  const cancelUpload = useCallback(() => {
    task.cancel();
    if (notification.current !== undefined) toast.dismiss(notification.current);
    notification.current = undefined;
    setLoading(false);
  }, [task]);
  const runUpload = async (
    options: MineSkinUploadOptions,
    messages: {
      loading: string;
      success: string;
      error: (cause: unknown) => string;
    },
    complete: (response: MineSkinCompletedResponse) => void,
  ) => {
    cancelUpload();
    setLoading(true);
    const id = toast.loading(messages.loading);
    notification.current = id;
    await task.run(
      (signal) => uploadMineSkinFile(options, signal),
      (response) => {
        complete(response);
        setLoading(false);
        toast.success(messages.success, { id });
      },
      (cause) => {
        setLoading(false);
        toast.error(messages.error(cause), { id });
      },
    );
  };
  return { loading, cancelUpload, runUpload };
}
