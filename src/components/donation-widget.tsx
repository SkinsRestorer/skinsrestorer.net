import { ArrowUpRight } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { useT } from "@/lib/i18n-react";

/**
 * A donation form that loads only when the visitor asks for it. The page
 * stays short, and Ko-fi and NOWPayments are not contacted on page view.
 */
export function DonationWidget(props: {
  href: string;
  label: string;
  frame: ComponentProps<"iframe"> & { title: string };
}) {
  const t = useT();
  const [shown, setShown] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const link = (
    <a
      href={props.href}
      className="inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2"
    >
      {props.label}
      <ArrowUpRight aria-hidden className="size-3.5" />
    </a>
  );
  if (!shown) {
    return (
      <CardFooter className="mt-auto flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // The button unmounts, so move focus to the form that replaces it.
            flushSync(() => {
              setShown(true);
            });
            frameRef.current?.focus();
          }}
        >
          {t("pricing.showDonationForm")}
        </Button>
        {link}
      </CardFooter>
    );
  }
  return (
    <>
      <CardContent className="flex-1">
        {/* oxlint-disable-next-line react/iframe-missing-sandbox -- The Ko-fi and NOWPayments checkouts open PayPal, card, and wallet flows that a sandbox can break, and they cannot be tested without a real payment. */}
        <iframe ref={frameRef} {...props.frame} title={props.frame.title} />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="flex flex-wrap items-center justify-center gap-1 text-sm text-muted-foreground">
          {t("pricing.widgetNotLoading")}
          {link}
        </p>
      </CardFooter>
    </>
  );
}
