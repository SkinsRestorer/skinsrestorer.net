"use client";

import { X } from "lucide-react";
import { Link } from "fumadocs-core/link";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAsRef } from "@/hooks/use-as-ref";
import { analytics } from "@/lib/analytics";
import { consentBannerState } from "@/lib/analytics-consent";
import {
  onCookieSettingsOpen,
  openCookieSettings,
  useAnalyticsConsent,
} from "@/lib/hooks/use-analytics-consent";
import { useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";

const CookieConsentBanner = () => {
  const t = useT();
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // The stored choice is read after hydration and updates with each choice.
  const consentState = useAnalyticsConsent();
  const [reopened, setReopened] = useState(false);

  useEffect(
    () =>
      onCookieSettingsOpen((element) => {
        opener.current = element;
        setReopened(true);
        // Already open: move focus now, because the effect below will not rerun.
        section.current?.focus();
      }),
    [],
  );

  // Opened from cookie settings: move focus so keyboard users land on the choice.
  useEffect(() => {
    if (reopened) section.current?.focus();
  }, [reopened]);

  const close = () => {
    setReopened(false);
    // Return focus to the control that opened the banner.
    if (opener.current?.isConnected) opener.current.focus();
    opener.current = null;
  };

  // Escape dismisses the reopened banner without changing the stored choice.
  // A first-time visitor must still pick an option.
  const { visible, dismissible } = consentBannerState(consentState, reopened);
  const closeRef = useAsRef(close);
  useEffect((): (() => void) | undefined => {
    if (!dismissible) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeRef, dismissible]);

  const handleAcceptCookies = () => {
    analytics.allow();
    close();
  };

  const handleDeclineCookies = () => {
    analytics.decline();
    close();
  };

  if (!visible) return null;

  // A slim bar along the bottom edge, so it never covers the page's own
  // buttons in a corner.
  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="group fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-6 lg:px-8">
        <div className="flex flex-1 flex-col gap-1 text-sm">
          <h2 id={titleId} className="font-semibold">
            {t("consent.websiteAnalytics")}
          </h2>
          <p className="text-muted-foreground">
            {t("consent.weUseAnalyticsCookiesSeeWhichPages")}{" "}
            {t.rich("consent.allowAnalyticsDetails", {
              policy: (
                <Link
                  href="/cookie-policy"
                  className="text-foreground underline underline-offset-2"
                />
              ),
            })}
          </p>
          {dismissible ? (
            <p className="font-medium">
              {consentState === "granted"
                ? t("consent.currentChoiceAllowed")
                : t("consent.currentChoiceDeclined")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            onClick={handleDeclineCookies}
            variant={consentState === "denied" ? "default" : "secondary"}
            className="flex-1 md:flex-none"
          >
            {t("consent.decline")}
          </Button>
          <Button
            type="button"
            onClick={handleAcceptCookies}
            variant={consentState === "denied" ? "secondary" : "default"}
            className="flex-1 md:flex-none"
          >
            {t("common.allowAnalytics")}
          </Button>
          {dismissible ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={close}
              aria-label={t("common.close")}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

/** Reopen the consent banner from the site footer or the docs sidebar. */
function CookieSettingsButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={(event) => {
        openCookieSettings(event.currentTarget);
      }}
      className={cn("cursor-pointer", className)}
    >
      {t("footer.cookieSettings")}
    </button>
  );
}

export { CookieConsentBanner, CookieSettingsButton };
