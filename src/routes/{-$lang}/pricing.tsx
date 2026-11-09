import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/home-layout";
import { isLocale } from "@/lib/i18n";
import { getPageHead } from "@/lib/seo";
import { SiBitcoin, SiKofi } from "@icons-pack/react-simple-icons";
import { Check, Gift, Heart, Users } from "lucide-react";
import Link from "fumadocs-core/link";
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
  "pricing.helpKeepProjectAlive",
] as const;

function PricingPage() {
  const t = useT();
  return (
    <div className="px-4 pt-4 pb-6 w-full max-w-[1400px] mx-auto flex-1 md:pb-12">
      <section className="py-8 md:py-16">
        <div className="flex flex-col items-center text-center gap-4 mb-12 md:mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t("pricing.simpleTransparentPricing")}
          </h1>
          <p className="max-w-[600px] text-muted-foreground md:text-lg">
            {t("pricing.skinsrestorerAlwaysWillFreeIfYouLove")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="relative flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center size-10 rounded-lg bg-muted">
                  <Users className="size-5" />
                </div>
                <CardTitle className="text-xl">{t("pricing.free")}</CardTitle>
              </div>
              <CardDescription>
                {t("pricing.everythingYouNeedManageSkinsServer")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold tracking-tight">0€</span>
                <span className="text-muted-foreground ml-1">/month</span>
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
            <div className="absolute inset-x-0 -top-px mx-auto h-px w-3/4 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10">
                  <Heart className="size-5 text-primary" />
                </div>
                <CardTitle className="text-xl">
                  {t("pricing.supporter")}
                </CardTitle>
                <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {t("pricing.popular")}
                </span>
              </div>
              <CardDescription>
                {t("pricing.supportProjectGetPriorityHelpWhenYou")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="mb-6">
                <span className="text-4xl font-bold tracking-tight">5€</span>
                <span className="text-muted-foreground ml-1">/month</span>
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
                  <a href="http://ko-fi.com/skinsrestorer/tiers">
                    <SiKofi className="h-4 w-4" />
                    {t("pricing.becomeSupporter")}
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
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground max-w-[500px] mx-auto">
            {t("pricing.supporterPerksDeliveredThroughOur")}{" "}
            <a href="/discord" className="underline hover:text-foreground">
              {t("pricing.discordServer")}
            </a>
            {t("pricing.afterSubscribingKoFiYouLlReceive")}
          </p>
        </div>
      </section>

      {/* One-time Donations */}
      <section className="py-8 md:py-16 border-t">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
            <Gift className="size-6" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("pricing.oneTimeDonations")}
          </h2>
          <p className="max-w-[600px] text-muted-foreground md:text-lg">
            {t("pricing.wantSupportSkinsrestorerWithoutRecurringCommitmentYou")}
          </p>
          <p className="text-sm text-muted-foreground max-w-[500px]">
            {t("pricing.onlyKoFi")} <strong>{t("pricing.membership")}</strong>{" "}
            {t("pricing.grantsSupporterPerksOneTimePaymentsVia")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Ko-fi Widget */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <SiKofi className="size-5" />
                <CardTitle className="text-xl">{"Ko-fi"}</CardTitle>
              </div>
              <CardDescription>
                {t("pricing.donateViaPaypalCardMembershipOneTime")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <iframe
                src="https://ko-fi.com/skinsrestorer/?hidefeed=true&widget=true&embed=true&preview=true"
                className="w-full border-none"
                height="712"
                title={t("pricing.koFiDonationWidgetSkinsrestorer")}
              />
            </CardContent>
          </Card>

          {/* NOWPayments Crypto Widget */}
          <Card className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <SiBitcoin className="size-5" />
                <CardTitle className="text-xl">{t("pricing.crypto")}</CardTitle>
              </div>
              <CardDescription>
                {t("pricing.donateCryptocurrencyViaNowpayments")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              <iframe
                src="https://nowpayments.io/embeds/donation-widget?api_key=bae4c439-45fd-44b6-918d-b91054b8d6af"
                width="346"
                height="623"
                className="border-none overflow-y-hidden"
                title={t("pricing.nowpaymentsCryptoDonationWidget")}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/{-$lang}/pricing")({
  head: ({ params }) =>
    getPageHead("/pricing", {
      locale: isLocale(params.lang) ? params.lang : "en",
      title: "pricing.pricing",
      description: "pricing.skinsrestorerFreeOpenSourceSupportDevelopmentGet",
    }),
  component: () => (
    <HomeLayout>
      <PricingPage />
    </HomeLayout>
  ),
});
