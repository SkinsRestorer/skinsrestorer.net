"use client";

import { useEffect, useState } from "react";

type GoogleFcWindow = {
  callbackQueue?: Record<string, () => void>[];
  showRevocationMessage?: () => void;
};

type WindowWithGoogleFc = Window & {
  googlefc?: GoogleFcWindow;
};

export function PrivacySettingsLink() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const browserWindow = window as WindowWithGoogleFc;

    browserWindow.googlefc = browserWindow.googlefc || {};
    browserWindow.googlefc.callbackQueue =
      browserWindow.googlefc.callbackQueue || [];
    const { callbackQueue, showRevocationMessage } = browserWindow.googlefc;

    if (typeof showRevocationMessage === "function") {
      setIsReady(true);
      return;
    }

    callbackQueue.push({
      CONSENT_API_READY: () => setIsReady(true),
    });
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() =>
        (window as WindowWithGoogleFc).googlefc?.showRevocationMessage?.()
      }
      className="cursor-pointer hover:text-fd-foreground"
    >
      Privacy &amp; cookie settings
    </button>
  );
}
