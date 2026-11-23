"use client";

import { Cookie, X } from "lucide-react";
import { Link } from "fumadocs-core/link";
import { posthog } from "posthog-js";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAsRef } from "@/hooks/use-as-ref";
import { allowAnalytics, declineAnalytics } from "@/lib/analytics";
import { useT } from "@/lib/i18n-react";
import { cn } from "@/lib/utils";

const reopenListeners = new Set<(opener: HTMLElement | null) => void>();

/** Show the consent banner again so visitors can change their choice. */
function openCookieSettings(opener: HTMLElement | null) {
  for (const listener of reopenListeners) listener(opener);
}

type ConsentState = ReturnType<typeof posthog.get_explicit_consent_status>;

const subscribeNever = () => () => {};

const CookieConsentBanner = () => {
  const t = useT();
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  // The stored choice is read after hydration. A choice made here replaces it.
  const storedConsent = useSyncExternalStore<ConsentState | "">(
    subscribeNever,
    () => posthog.get_explicit_consent_status(),
    () => "",
  );
  const [chosenConsent, setChosenConsent] = useState<ConsentState>();
  const consentState = chosenConsent ?? storedConsent;
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = (element: HTMLElement | null) => {
      opener.current = element;
      // Read the stored choice again so the banner shows the current value.
      setChosenConsent(posthog.get_explicit_consent_status());
      setReopened(true);
      // Already open: move focus now, because the effect below will not rerun.
      section.current?.focus();
    };
    reopenListeners.add(reopen);
    return () => {
      reopenListeners.delete(reopen);
    };
  }, []);

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
  const dismissible = reopened && consentState !== "pending";
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
    allowAnalytics();
    setChosenConsent("granted");
    close();
  };

  const handleDeclineCookies = () => {
    declineAnalytics();
    setChosenConsent("denied");
    close();
  };

  if (consentState !== "pending" && !reopened) {
    return null;
  }

  return (
    <section
      ref={section}
      tabIndex={-1}
      aria-labelledby={titleId}
      className="group fixed inset-x-0 bottom-0 z-50 outline-none sm:right-auto sm:bottom-4 sm:left-4"
    >
      {/* Shows focus when the banner is reopened from Cookie settings. */}
      <div className="m-3 rounded-xl group-focus-visible:ring-2 group-focus-visible:ring-ring sm:max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-0 pb-2">
            <CardTitle id={titleId} className="text-lg">
              {t("consent.websiteAnalytics")}
            </CardTitle>
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
            ) : (
              <Cookie aria-hidden="true" className="size-5" />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <CardDescription>
              {t("consent.weUseAnalyticsCookiesSeeWhichPages")}
            </CardDescription>
            {dismissible ? (
              <p className="text-sm font-medium">
                {consentState === "granted"
                  ? t("consent.currentChoiceAllowed")
                  : t("consent.currentChoiceDeclined")}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t.rich("consent.allowAnalyticsDetails", {
                allow: (
                  <span className="font-medium">
                    {t("common.allowAnalytics")}
                  </span>
                ),
                policy: (
                  <Link
                    href="/cookie-policy"
                    className="underline underline-offset-2"
                  />
                ),
              })}
            </p>
          </CardContent>
          <CardFooter className="flex gap-2 pt-2">
            <Button
              type="button"
              onClick={handleDeclineCookies}
              variant={consentState === "denied" ? "default" : "secondary"}
              className="flex-1"
            >
              {t("consent.decline")}
            </Button>
            <Button
              type="button"
              onClick={handleAcceptCookies}
              variant={consentState === "denied" ? "secondary" : "default"}
              className="flex-1"
            >
              {t("common.allowAnalytics")}
            </Button>
          </CardFooter>
        </Card>
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
