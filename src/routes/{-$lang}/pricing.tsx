import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { SiBitcoin, SiKofi } from "@icons-pack/react-simple-icons";
import { ArrowUpRight, Check, Gift, Heart, Users } from "lucide-react";
import { Link } from "fumadocs-core/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRef, useState, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { useLocale, useT } from "@/lib/i18n-react";
import type { Locale } from "@/lib/i18n";

const freePlanFeatures = [
  "pricing.fullSkinsrestorerPlugin",
  "pricing.allPlatformsSupported",
  "pricing.communitySupport",
  "pricing.openSourceGpl30",
  "pricing.unlimitedPlayers",
] as const;

const supporterPlanFeatures = [
  "pricing.prioritySupportViaDiscord",
  "pricing.priorityFeatureRequests",
  "pricing.supporterRoleDiscord",
  "pricing.supportOngoingDevelopment",
] as const;

const koFiUrl = "https://ko-fi.com/skinsrestorer";
const nowPaymentsUrl =
  "https://nowpayments.io/embeds/donation-widget?api_key=bae4c439-45fd-44b6-918d-b91054b8d6af";

/** Format a whole-euro price with the locale's symbol position and spacing. */
function formatEuros(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function PricingPage() {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-6 md:pb-12">
      <section className="py-8 md:py-16">
        <div className="mb-12 flex flex-col items-center gap-4 text-center md:mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t("pricing.freeAndSupporterPlans")}
          </h1>
          <p className="max-w-[600px] text-muted-foreground md:text-lg">
            {t("pricing.skinsrestorerAlwaysWillFreeIfYouLove")}
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Free Plan */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Users className="size-5" />
                </div>
                <CardTitle className="text-xl">
                  <h2>{t("pricing.free")}</h2>
                </CardTitle>
              </div>
              <CardDescription>
                {t("pricing.everythingYouNeedManageSkinsServer")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold tracking-tight">
                  {formatEuros(0, locale)}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {freePlanFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="size-4 shrink-0 text-primary" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                render={
                  <Link href="/docs/installation">
                    {t("pricing.getStarted")}
                  </Link>
                }
                nativeButton={false}
                variant="outline"
                className="w-full"
                size="lg"
              />
            </CardFooter>
          </Card>

          {/* Supporter Plan */}
          <Card className="relative flex flex-col border-primary/50 shadow-lg shadow-primary/5">
            <div className="absolute inset-x-0 -top-px mx-auto h-px w-3/4 bg-linear-to-r from-transparent via-primary to-transparent" />
            <CardHeader>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <Heart className="size-5 text-primary" />
                </div>
                <CardTitle className="text-xl">
                  <h2>{t("pricing.supporter")}</h2>
                </CardTitle>
              </div>
              <CardDescription>
                {t("pricing.supportProjectGetPriorityHelpWhenYou")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold tracking-tight">
                  {formatEuros(5, locale)}
                </span>
                <span className="ml-1 text-muted-foreground">
                  {t("common.month")}
                </span>
              </div>
              <ul className="flex flex-col gap-3">
                {supporterPlanFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm">
                    <Check className="size-4 shrink-0 text-primary" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                render={
                  <a href={`${koFiUrl}/tiers`}>
                    <SiKofi aria-hidden className="size-4" />
                    {t("pricing.becomeSupporter")}
                    <ArrowUpRight aria-hidden className="size-4" />
                  </a>
                }
                nativeButton={false}
                className="w-full"
                size="lg"
              />
            </CardFooter>
          </Card>
        </div>

        {/* Bottom note */}
        <div className="mx-auto mt-12 flex max-w-[500px] flex-col gap-2 text-center">
          <h2 className="font-semibold">
            {t("pricing.howToGetSupporterPerks")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.rich("pricing.supporterPerksDiscord", {
              discord: (
                // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
                <a
                  href="/discord"
                  className="underline underline-offset-2 hover:text-foreground"
                />
              ),
            })}{" "}
            {t.rich("pricing.onlyMembershipGrantsPerks", {
              strong: <strong />,
            })}
          </p>
        </div>
      </section>

      {/* One-time Donations */}
      <section className="border-t py-8 md:py-16">
        <div className="mb-12 flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <Gift className="size-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("pricing.oneTimeDonations")}
          </h2>
          <p className="max-w-[600px] text-muted-foreground md:text-lg">
            {t("pricing.wantSupportSkinsrestorerWithoutRecurringCommitmentYou")}
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* Ko-fi Widget */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex items-center gap-3">
                <SiKofi aria-hidden className="size-5" />
                <CardTitle className="text-xl">
                  <h3>Ko-fi</h3>
                </CardTitle>
              </div>
              <CardDescription>
                {t("pricing.donateViaPaypalOrCard")}
              </CardDescription>
            </CardHeader>
            <DonationWidget
              href={koFiUrl}
              label={t("pricing.openKoFi")}
              frame={{
                src: `${koFiUrl}/?hidefeed=true&widget=true&embed=true&preview=true`,
                className: "w-full border-none",
                height: 712,
                title: t("pricing.koFiDonationWidgetSkinsrestorer"),
              }}
            />
          </Card>

          {/* NOWPayments Crypto Widget */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="mb-2 flex items-center gap-3">
                <SiBitcoin aria-hidden className="size-5" />
                <CardTitle className="text-xl">
                  <h3>{t("pricing.crypto")}</h3>
                </CardTitle>
              </div>
              <CardDescription>
                {t("pricing.donateCryptocurrencyViaNowpayments")}
              </CardDescription>
            </CardHeader>
            <DonationWidget
              href={nowPaymentsUrl}
              label={t("pricing.openNowpayments")}
              frame={{
                src: nowPaymentsUrl,
                width: 346,
                height: 623,
                className:
                  "mx-auto block max-w-full overflow-y-hidden border-none",
                title: t("pricing.nowpaymentsCryptoDonationWidget"),
              }}
            />
          </Card>
        </div>
      </section>
    </div>
  );
}

/**
 * A donation form that loads only when the visitor asks for it. The page
 * stays short, and Ko-fi and NOWPayments are not contacted on page view.
 */
function DonationWidget(props: {
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

export const Route = createFileRoute("/{-$lang}/pricing")({
  head: ({ params }) =>
    getPageHead("/pricing", {
      locale: isLocale(params.lang) ? params.lang : "en",
      titleKey: "pricing.pricing",
      descriptionKey:
        "pricing.skinsrestorerFreeOpenSourceSupportDevelopmentGet",
    }),
  component: () => (
    <HomeLayout>
      <PricingPage />
    </HomeLayout>
  ),
});
