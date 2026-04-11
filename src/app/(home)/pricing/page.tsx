import { SiDiscord } from "@icons-pack/react-simple-icons";
import { Check, Heart, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SkinsRestorer is free and open source. Support development and get priority Discord support.",
};

const freePlanFeatures = [
  "Full SkinsRestorer plugin",
  "All platforms supported",
  "Community support",
  "Open source (GPL-3.0)",
  "Unlimited players",
];

const supporterPlanFeatures = [
  "Priority support via Discord",
  "Supporter role in Discord",
  "Support ongoing development",
  "Help keep the project alive",
  "Early access to announcements",
];

export default function PricingPage() {
  return (
    <div className="px-4 pt-4 pb-6 w-full max-w-[1400px] mx-auto flex-1 md:pb-12">
      <section className="py-8 md:py-16">
        <div className="flex flex-col items-center text-center gap-4 mb-12 md:mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="max-w-[600px] text-muted-foreground md:text-lg">
            SkinsRestorer is and always will be free. If you love the project,
            consider becoming a supporter.
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
                <CardTitle className="text-xl">Free</CardTitle>
              </div>
              <CardDescription>
                Everything you need to manage skins on your server.
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
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/docs/installation">Get Started</Link>
              </Button>
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
                <CardTitle className="text-xl">Supporter</CardTitle>
                <span className="ml-auto inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Popular
                </span>
              </div>
              <CardDescription>
                Support the project and get priority help when you need it.
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
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full gap-2" size="lg">
                <a href="http://ko-fi.com/skinsrestorer/tiers">
                  <SiDiscord className="size-4" />
                  Become a Supporter
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Bottom note */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground max-w-[500px] mx-auto">
            Supporter perks are delivered through our Discord server. After
            subscribing on Ko-fi, you&apos;ll receive your supporter role and
            access to priority support channels.
          </p>
        </div>
      </section>
    </div>
  );
}
