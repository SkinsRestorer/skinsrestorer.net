"use client";

import { Cookie } from "lucide-react";
import Link from "fumadocs-core/link";
import posthog from "posthog-js";
import { useEffect, useState } from "react";

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

const CookieConsentBanner = () => {
  const t = useT();
  const [consentState, setConsentState] = useState<
    ReturnType<typeof posthog.get_explicit_consent_status> | ""
  >("");

  useEffect(() => {
    setConsentState(posthog.get_explicit_consent_status());
  }, []);

  const handleAcceptCookies = () => {
    posthog.opt_in_capturing();
    setConsentState("granted");
  };

  const handleDeclineCookies = () => {
    posthog.opt_out_capturing();
    setConsentState("denied");
  };

  if (consentState !== "pending") {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 z-50 sm:bottom-4 sm:left-4">
      <Card className="m-3 shadow-lg sm:max-w-md">
        <CardHeader className="flex flex-row items-center justify-between gap-0 pb-2">
          <CardTitle className="text-lg">
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
    </div>
  );
};

export { CookieConsentBanner };
