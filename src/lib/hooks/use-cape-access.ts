import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLatestTask } from "./use-latest-task";

import {
  fetchCapeSupport,
  fetchMineSkinSupportedCapes,
  type MineSkinCape,
} from "@/lib/mineskin";
import { useNotificationT } from "@/lib/i18n-react";

import type { CapeStatus } from "@/lib/studio-options";

/**
 * The capes MineSkin offers and whether the entered API key may apply them.
 * The key itself belongs to the form; this hook only receives it for an
 * explicit check and never keeps it.
 */
export function useCapeAccess(options: { readonly keyRequired: boolean }) {
  const t = useNotificationT();
  const verification = useLatestTask();
  const availableCapes = useLatestTask();
  const [keyStatus, setKeyStatus] = useState<CapeStatus>("idle");
  const [supportedCapes, setSupportedCapes] = useState<MineSkinCape[]>([]);
  /** The public cape list: loading shows placeholders, failed offers a retry. */
  const [listStatus, setListStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [listAttempt, setListAttempt] = useState(0);
  /** A checked key's capes win over the public list, whichever comes last. */
  const keyCapes = useRef(false);

  // Axolotl applies capes without a key.
  const status: CapeStatus = options.keyRequired ? keyStatus : "granted";
  const capeOptionsDisabled =
    status !== "granted" || supportedCapes.length === 0;

  useEffect(() => {
    void availableCapes.run(
      (signal) => fetchMineSkinSupportedCapes(undefined, signal),
      (capes) => {
        if (!keyCapes.current) setSupportedCapes(capes);
        setListStatus("ready");
      },
      // The picker shows the failure next to a retry button.
      () => setListStatus(keyCapes.current ? "ready" : "failed"),
    );
    return () => availableCapes.cancel();
  }, [availableCapes, listAttempt]);

  /** The key changed: its earlier check no longer applies. */
  const reset = () => {
    verification.cancel();
    setKeyStatus("idle");
  };

  /** Check the capes grant of this key, only when the user asks. */
  const verify = async (apiKey: string) => {
    if (!apiKey) {
      toast.warning(t("capes.enterMineskinApiKeyLoadCapes"));
      return;
    }
    setKeyStatus("loading");
    await verification.run(
      (signal) => fetchCapeSupport(apiKey, signal),
      ({ hasCapeGrant, capes }) => {
        if (!hasCapeGrant) {
          setKeyStatus("denied");
          toast.error(t("capes.apiKeyDoesNotHaveCapesGrant"));
          return;
        }
        setKeyStatus("granted");
        keyCapes.current = true;
        setSupportedCapes(capes);
        setListStatus("ready");
        if (capes.length === 0)
          toast.info(t("capes.noSupportedCapesCurrentlyAvailable"));
        else toast.success(t("capes.capeSupportEnabledApiKey"));
      },
      (error) => {
        setKeyStatus("idle");
        toast.error(
          error instanceof Error
            ? t.error(error)
            : t("capes.failedVerifyCapeSupport"),
        );
      },
    );
  };

  return {
    status,
    /** Whether the entered key passed its check, whatever the method. */
    keyGranted: keyStatus === "granted",
    capeOptionsDisabled,
    supportedCapes,
    /** Whether the cape list is still loading or could not be loaded. */
    listStatus,
    /** Load the public cape list again after a failure. */
    retryList: () => {
      setListStatus("loading");
      setListAttempt((attempt) => attempt + 1);
    },
    reset,
    verify,
  };
}
