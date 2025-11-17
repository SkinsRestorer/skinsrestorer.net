"use client";

import { Check, Cookie, X } from "lucide-react";
import posthog from "posthog-js";
import * as React from "react";

import "../../instrumentation-client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ConsentStatus = ReturnType<typeof posthog.get_explicit_consent_status>;
type ConsentState = ConsentStatus | "pending";

interface CookieConsentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "small" | "mini";
  demo?: boolean;
  onAcceptCallback?: () => void;
  onDeclineCallback?: () => void;
  description?: string;
}

const DEFAULT_DESCRIPTION =
  "We use tracking cookies to understand how you use the product and help us improve it. Please accept cookies to help us improve.";

const CookieConsent = React.forwardRef<HTMLDivElement, CookieConsentProps>(
  (
    {
      variant = "default",
      demo = false,
      onAcceptCallback = () => {},
      onDeclineCallback = () => {},
      className,
      description = DEFAULT_DESCRIPTION,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [hide, setHide] = React.useState(false);
    const [consentState, setConsentState] =
      React.useState<ConsentState>("pending");

    const closeWithDelay = React.useCallback(() => {
      setIsOpen(false);
      setTimeout(() => {
        setHide(true);
      }, 700);
    }, []);

    const handleAccept = React.useCallback(() => {
      try {
        posthog.opt_in_capturing();
      } catch (error) {
        console.warn("Cookie consent error:", error);
      }
      setConsentState("granted");
      closeWithDelay();
      onAcceptCallback();
    }, [closeWithDelay, onAcceptCallback]);

    const handleDecline = React.useCallback(() => {
      try {
        posthog.opt_out_capturing();
      } catch (error) {
        console.warn("Cookie consent error:", error);
      }
      setConsentState("denied");
      closeWithDelay();
      onDeclineCallback();
    }, [closeWithDelay, onDeclineCallback]);

    React.useEffect(() => {
      if (demo) {
        setIsOpen(true);
        return;
      }

      let status: ConsentState = "pending";
      try {
        status = posthog.get_explicit_consent_status() ?? "pending";
      } catch (error) {
        console.warn("Cookie consent error:", error);
      }

      setConsentState(status);

      if (status === "granted" || status === "denied") {
        setHide(true);
        return;
      }

      setIsOpen(true);
    }, [demo]);

    if (hide || consentState !== "pending") {
      return null;
    }

    const containerClasses = cn(
      "fixed z-50 transition-all duration-700",
      !isOpen ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
      className,
    );

    const commonWrapperProps = {
      ref,
      className: cn(
        containerClasses,
        variant === "mini"
          ? "left-0 right-0 sm:left-4 bottom-4 w-full sm:max-w-3xl"
          : "bottom-0 left-0 right-0 sm:left-4 sm:bottom-4 w-full sm:max-w-md",
      ),
      ...props,
    };

    if (variant === "default") {
      return (
        <div {...commonWrapperProps}>
          <Card className="m-3 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">We use cookies</CardTitle>
              <Cookie className="h-5 w-5" aria-hidden />
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-sm">
                {description}
              </CardDescription>
              <p className="text-xs text-muted-foreground">
                By clicking <span className="font-medium">"Accept"</span>, you
                agree to our use of cookies.
              </p>
            </CardContent>
            <CardFooter className="flex gap-2 pt-2">
              <Button
                onClick={handleDecline}
                variant="secondary"
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" aria-hidden />
                Decline
              </Button>
              <Button onClick={handleAccept} className="flex-1">
                <Check className="mr-2 h-4 w-4" aria-hidden />
                Accept
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if (variant === "small") {
      return (
        <div {...commonWrapperProps}>
          <Card className="m-3 shadow-lg">
            <CardHeader className="flex h-0 flex-row items-center justify-between space-y-0 px-4 pb-2">
              <CardTitle className="text-base">We use cookies</CardTitle>
              <Cookie className="h-4 w-4" aria-hidden />
            </CardHeader>
            <CardContent className="px-4 pb-2 pt-0">
              <CardDescription className="text-sm">
                {description}
              </CardDescription>
            </CardContent>
            <CardFooter className="flex h-0 gap-2 px-4 py-2">
              <Button
                onClick={handleDecline}
                variant="secondary"
                size="sm"
                className="flex-1 rounded-full"
              >
                <X className="mr-2 h-4 w-4" aria-hidden />
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                size="sm"
                className="flex-1 rounded-full"
              >
                <Check className="mr-2 h-4 w-4" aria-hidden />
                Accept
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if (variant === "mini") {
      return (
        <div {...commonWrapperProps}>
          <Card className="mx-3 p-0 py-3 shadow-lg">
            <CardContent className="grid gap-4 p-0 px-3.5 sm:flex">
              <CardDescription className="flex-1 text-xs sm:text-sm">
                {description}
              </CardDescription>
              <div className="flex items-center justify-end gap-2 sm:gap-3">
                <Button
                  onClick={handleDecline}
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs"
                >
                  <X className="mr-2 hidden h-4 w-4 sm:inline" aria-hidden />
                  Decline
                </Button>
                <Button
                  onClick={handleAccept}
                  size="sm"
                  className="h-7 text-xs"
                >
                  <Check
                    className="mr-2 hidden h-4 w-4 sm:inline"
                    aria-hidden
                  />
                  Accept
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return null;
  },
);

CookieConsent.displayName = "CookieConsent";

const CookieConsentBanner = (
  props: Omit<CookieConsentProps, "variant">,
): React.ReactElement => <CookieConsent variant="mini" {...props} />;

export { CookieConsent, CookieConsentBanner };
export default CookieConsent;
