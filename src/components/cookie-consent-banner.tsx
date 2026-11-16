"use client";

import { Cookie } from "lucide-react";
import Link from "fumadocs-core/link";
import posthog from "posthog-js";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/lib/i18n-react";

const reopenListeners = new Set<() => void>();

/** Show the consent banner again so visitors can change their choice. */
function openCookieSettings() {
  for (const listener of reopenListeners) listener();
}

const CookieConsentBanner = () => {
  const t = useT();
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const [consentState, setConsentState] = useState<
    ReturnType<typeof posthog.get_explicit_consent_status> | ""
  >("");
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    setConsentState(posthog.get_explicit_consent_status());
    const reopen = () => setReopened(true);
    reopenListeners.add(reopen);
    return () => {
      reopenListeners.delete(reopen);
    };
  }, []);

  // Opened from the footer: move focus so keyboard users land on the choice.
  useEffect(() => {
    if (reopened) section.current?.focus();
  }, [reopened]);

  const handleAcceptCookies = () => {
    posthog.opt_in_capturing();
    setConsentState("granted");
    setReopened(false);
  };

  const handleDeclineCookies = () => {
    posthog.opt_out_capturing();
    setConsentState("denied");
    setReopened(false);
  };

  if (consentState !== "pending" && !reopened) {
    return null;
  }

  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="fixed inset-x-0 bottom-0 z-50 outline-none sm:right-auto sm:bottom-4 sm:left-4"
    >
      <Card className="m-3 shadow-lg sm:max-w-md">
        <CardHeader className="flex flex-row items-center justify-between gap-0 pb-2">
          <CardTitle id={titleId} className="text-lg">
            {t("consent.websiteAnalytics")}
          </CardTitle>
          <Cookie className="h-5 w-5" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <CardDescription>
            {t("consent.weUseAnalyticsCookiesSeeWhichPages")}
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            {t("consent.select")}{" "}
            <span className="font-medium">{t("common.allowAnalytics")}</span>{" "}
            {t("consent.enableTheseCookiesReadOur")}{" "}
            <Link
              href="/cookie-policy"
              className="underline underline-offset-2"
            >
              {t("common.cookiePolicy")}
            </Link>{" "}
            {t("consent.details")}
          </p>
        </CardContent>
        <CardFooter className="flex gap-2 pt-2">
          <Button
            type="button"
            onClick={handleDeclineCookies}
            variant="secondary"
            className="flex-1"
          >
            {t("consent.decline")}
          </Button>
          <Button
            type="button"
            onClick={handleAcceptCookies}
            className="flex-1"
          >
            {t("common.allowAnalytics")}
          </Button>
        </CardFooter>
      </Card>
    </section>
  );
};

/** Reopen the consent banner from the site footer or the docs sidebar. */
function CookieSettingsButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {t("footer.cookieSettings")}
    </button>
  );
}

export { CookieConsentBanner, CookieSettingsButton };
