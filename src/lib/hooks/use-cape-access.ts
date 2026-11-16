import { useEffect, useState } from "react";
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
  const [publicCapes, setPublicCapes] = useState<MineSkinCape[]>([]);
  /** The capes of the last key that passed its check. */
  const [keyCapes, setKeyCapes] = useState<MineSkinCape[]>();
  /** The public cape list: loading shows placeholders, failed offers a retry. */
  const [publicStatus, setPublicStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [listAttempt, setListAttempt] = useState(0);

  // Axolotl applies capes without a key, from the public list. Official uses
  // the checked key's capes once the key passes.
  const status: CapeStatus = options.keyRequired ? keyStatus : "granted";
  const fromKey = options.keyRequired ? keyCapes : undefined;
  const supportedCapes = fromKey ?? publicCapes;
  const listStatus = fromKey ? "ready" : publicStatus;
  const capeOptionsDisabled =
    status !== "granted" || supportedCapes.length === 0;

  useEffect(() => {
    void availableCapes.run(
      (signal) => fetchMineSkinSupportedCapes(undefined, signal),
      (capes) => {
        setPublicCapes(capes);
        setPublicStatus("ready");
      },
      // The picker shows the failure next to a retry button.
      () => setPublicStatus("failed"),
    );
    return () => availableCapes.cancel();
  }, [availableCapes, listAttempt]);

  /** The key changed: its earlier check and capes no longer apply. */
  const reset = () => {
    verification.cancel();
    setKeyStatus("idle");
    setKeyCapes(undefined);
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
        setKeyCapes(capes);
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
      setPublicStatus("loading");
      setListAttempt((attempt) => attempt + 1);
    },
    reset,
    verify,
  };
}
