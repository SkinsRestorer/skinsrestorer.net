"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

type GoogleFcConsentModeStatus = {
  analyticsStoragePurposeConsentStatus?: number;
};

type GoogleFcWindow = {
  callbackQueue?: Record<string, () => void>[];
  ConsentModePurposeStatusEnum?: {
    UNKNOWN: number;
    GRANTED: number;
    DENIED: number;
    NOT_APPLICABLE: number;
    NOT_CONFIGURED: number;
  };
  getGoogleConsentModeValues?: () => GoogleFcConsentModeStatus;
};

type WindowWithGoogleFc = Window & {
  googlefc?: GoogleFcWindow;
  __tcfapi?: (
    command: "addEventListener",
    version: number,
    callback: (_data: unknown, success: boolean) => void,
  ) => void;
};

const syncPostHogConsent = () => {
  const googlefc = (window as WindowWithGoogleFc).googlefc;
  const consentModeValues = googlefc?.getGoogleConsentModeValues?.();
  const consentModeEnum = googlefc?.ConsentModePurposeStatusEnum;

  if (!consentModeValues || !consentModeEnum) {
    return;
  }

  const analyticsStorageConsent =
    consentModeValues.analyticsStoragePurposeConsentStatus;
  const explicitConsentStatus = posthog.get_explicit_consent_status();

  if (analyticsStorageConsent === consentModeEnum.DENIED) {
    if (explicitConsentStatus !== "denied") {
      posthog.opt_out_capturing();
    }
    return;
  }

  if (
    analyticsStorageConsent === consentModeEnum.GRANTED ||
    analyticsStorageConsent === consentModeEnum.NOT_APPLICABLE
  ) {
    if (explicitConsentStatus !== "granted") {
      posthog.opt_in_capturing({ captureEventName: false });
    }
    return;
  }

  if (
    process.env.NODE_ENV === "development" &&
    analyticsStorageConsent === consentModeEnum.NOT_CONFIGURED
  ) {
    console.warn(
      "Google consent mode is not configured for analytics storage; PostHog consent remains unchanged.",
    );
  }
};

export function GoogleConsentBridge() {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || typeof window === "undefined") {
      return;
    }

    const browserWindow = window as WindowWithGoogleFc;

    browserWindow.googlefc = browserWindow.googlefc || {};
    browserWindow.googlefc.callbackQueue =
      browserWindow.googlefc.callbackQueue || [];
    const { callbackQueue } = browserWindow.googlefc;

    callbackQueue.push({
      CONSENT_MODE_DATA_READY: syncPostHogConsent,
    });

    callbackQueue.push({
      CONSENT_API_READY: () => {
        browserWindow.__tcfapi?.("addEventListener", 2.2, (_data, success) => {
          if (success) {
            syncPostHogConsent();
          }
        });
      },
    });

    syncPostHogConsent();
  }, []);

  return null;
}
