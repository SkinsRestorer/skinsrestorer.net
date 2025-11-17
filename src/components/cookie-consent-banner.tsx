"use client";

import posthog from "posthog-js";
import { useEffect, useState } from "react";

import "../../instrumentation-client";

type ConsentStatus = ReturnType<typeof posthog.get_explicit_consent_status>;

type ConsentState = ConsentStatus | "pending";

export function CookieConsentBanner() {
  const [consentState, setConsentState] = useState<ConsentState>("pending");

  useEffect(() => {
    try {
      setConsentState(posthog.get_explicit_consent_status() ?? "pending");
    } catch (error) {
      console.warn("Cookie consent error:", error);
    }
  }, []);

  const handleAcceptCookies = () => {
    try {
      posthog.opt_in_capturing();
    } catch (error) {
      console.warn("Cookie consent error:", error);
    }
    setConsentState("granted");
  };

  const handleDeclineCookies = () => {
    try {
      posthog.opt_out_capturing();
    } catch (error) {
      console.warn("Cookie consent error:", error);
    }
    setConsentState("denied");
  };

  if (consentState !== "pending") {
    return null;
  }

  return (
    <div className="cookie-banner">
      <p>
        We use tracking cookies to understand how you use the product and help
        us improve it. Please accept cookies to help us improve.
      </p>
      <div className="cookie-banner__actions">
        <button type="button" onClick={handleAcceptCookies}>
          Accept cookies
        </button>
        <button type="button" onClick={handleDeclineCookies}>
          Decline cookies
        </button>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
