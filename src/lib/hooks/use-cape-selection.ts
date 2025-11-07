import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  fetchCapeSupport,
  fetchMineSkinSupportedCapes,
  type MineSkinCape,
} from "@/lib/mineskin";

export const NO_CAPE_VALUE = "__no_cape__" as const;

export type CapeStatus = "idle" | "loading" | "granted" | "denied";

interface UseCapeSelectionOptions {
  autoGrantCapeAccess?: boolean;
}

export function useCapeSelection(options: UseCapeSelectionOptions = {}) {
  const { autoGrantCapeAccess = false } = options;
  const [apiKey, setApiKey] = useState("");
  const [capeStatus, setCapeStatus] = useState<CapeStatus>(
    autoGrantCapeAccess ? "granted" : "idle",
  );
  const [supportedCapes, setSupportedCapes] = useState<MineSkinCape[]>([]);
  const [selectedCapeUuid, setSelectedCapeUuid] =
    useState<string>(NO_CAPE_VALUE);

  const normalizedApiKey = apiKey.trim();
  const capeOptionsDisabled = autoGrantCapeAccess
    ? supportedCapes.length === 0
    : capeStatus !== "granted" || supportedCapes.length === 0;

  const selectedCape = useMemo(() => {
    if (selectedCapeUuid === NO_CAPE_VALUE) {
      return undefined;
    }

    return supportedCapes.find((cape) => cape.uuid === selectedCapeUuid);
  }, [selectedCapeUuid, supportedCapes]);

  useEffect(() => {
    let isActive = true;

    const loadSupportedCapes = async () => {
      try {
        const capes = await fetchMineSkinSupportedCapes();
        if (!isActive) {
          return;
        }

        setSupportedCapes(capes);
      } catch (error) {
        if (!isActive) {
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load available capes",
        );
      }
    };

    loadSupportedCapes();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (autoGrantCapeAccess) {
      setCapeStatus("granted");
      return;
    }

    setSelectedCapeUuid(NO_CAPE_VALUE);
    setCapeStatus((status) => (status === "granted" ? "idle" : status));
  }, [autoGrantCapeAccess]);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setCapeStatus("idle");
    setSelectedCapeUuid(NO_CAPE_VALUE);
  };

  const handleCapeSelect = (value: string) => {
    if (value === NO_CAPE_VALUE) {
      setSelectedCapeUuid(NO_CAPE_VALUE);
      return;
    }

    if (
      !autoGrantCapeAccess &&
      (!normalizedApiKey || capeStatus !== "granted")
    ) {
      toast.warning("Enter and verify your API key before selecting a cape.");
      return;
    }

    setSelectedCapeUuid(value);
  };

  const loadCapeSupport = async () => {
    if (autoGrantCapeAccess) {
      setCapeStatus("granted");
      return;
    }

    if (!normalizedApiKey) {
      toast.warning("Enter your MineSkin API key to load capes.");
      return;
    }

    setCapeStatus("loading");
    setSelectedCapeUuid(NO_CAPE_VALUE);

    try {
      const { hasCapeGrant, capes } = await fetchCapeSupport(normalizedApiKey);

      if (!hasCapeGrant) {
        setCapeStatus("denied");
        toast.error(
          "Your API key does not have the capes grant. Please check your MineSkin plan.",
        );
        return;
      }

      setCapeStatus("granted");
      setSupportedCapes(capes);

      if (capes.length === 0) {
        toast.info("No supported capes are currently available.");
      } else {
        toast.success("Cape support enabled for this API key.");
      }
    } catch (error) {
      setCapeStatus("idle");
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to verify cape support",
      );
    }
  };

  return {
    apiKey,
    capeStatus,
    capeOptionsDisabled,
    normalizedApiKey,
    selectedCape,
    selectedCapeUuid,
    supportedCapes,
    handleApiKeyChange,
    handleCapeSelect,
    loadCapeSupport,
  };
}
