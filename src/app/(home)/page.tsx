import { SiGithub } from "@icons-pack/react-simple-icons";
import type { paths } from "@octokit/openapi-types";
import {
  ChevronsRight,
  CloudDownload,
  Download,
  Grid3X3,
  Image as ImageIcon,
  Rocket,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CustomTimeAgo } from "@/components/time-ago";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DotPattern } from "@/components/ui/dot-pattern";
import { Marquee } from "@/components/ui/marquee";
import { Meteors } from "@/components/ui/meteors";
import { RetroGrid } from "@/components/ui/retro-grid";
import { Ripple } from "@/components/ui/ripple";
import { HeroBackground, HomeFaq } from "./page.client";

type LatestReleaseResponse =
  paths["/repos/{owner}/{repo}/releases/latest"]["get"]["responses"]["200"]["content"]["application/json"];

async function getReleaseData(): Promise<LatestReleaseResponse> {
  const response = await fetch(
    "https://api.github.com/repos/SkinsRestorer/SkinsRestorer/releases/latest",
    {
      next: {
        revalidate: 120,
      },
    },
  );
  return await response.json();
}

async function LatestRelease() {
  const data: LatestReleaseResponse = await getReleaseData();
  const versionTag = data.tag_name.startsWith("v")
    ? data.tag_name.slice(1)
    : data.tag_name;
  const releaseLink = `https://modrinth.com/plugin/skinsrestorer/version/${versionTag}`;
  const fabricReleaseLink = `https://modrinth.com/plugin/skinsrestorer/version/${versionTag}-fabric`;
  const neoforgeReleaseLink = `https://modrinth.com/plugin/skinsrestorer/version/${versionTag}-neoforge`;
  return (
    <Card className="relative overflow-hidden bg-background/80 backdrop-blur-sm shadow-xl">
      <BorderBeam
        size={200}
        duration={8}
        colorFrom="#B2A711"
        colorTo="#d4c91a"
        borderWidth={2}
      />
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">
            <a
              href={releaseLink}
              className="hover:text-primary transition-colors"
            >
              {data.name}
            </a>
          </CardTitle>
          <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-700">
            Latest Release
          </span>
        </div>
        <CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <span>Released by</span>
            <div className="flex items-center gap-2">
              <Image
                className="rounded-full w-6 h-6"
                src={data.author.avatar_url}
                width={24}
                height={24}
                alt={data.author.login}
              />
              <span className="font-medium">{data.author.login}</span>
            </div>
            <Suspense>
              <CustomTimeAgo date={data.published_at || new Date()} />
            </Suspense>
          </div>
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex flex-col gap-2">
        <Button asChild variant="outline" className="w-full">
          <a href={releaseLink}>
            <Download className="w-4 h-4" />
            Download (Server / Proxy)
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <a href={fabricReleaseLink}>
            <Download className="w-4 h-4" />
            Download (Fabric)
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <a href={neoforgeReleaseLink}>
            <Download className="w-4 h-4" />
            Download (NeoForge)
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

const TeamCard = ({
  githubUsername,
  description,
}: {
  githubUsername: string;
  description: string;
}) => {
  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <a
          href={`https://github.com/${githubUsername}`}
          className="flex flex-col sm:flex-row items-center gap-4 hover:opacity-80 transition-opacity"
        >
          <Image
            src={`https://github.com/${githubUsername}.png`}
            width={64}
            height={64}
            className="rounded-lg"
            alt={githubUsername}
          />
          <div className="flex flex-col text-center sm:text-left">
            <CardTitle className="text-lg">{githubUsername}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </a>
      </div>
    </Card>
  );
};

const skinCommands = [
  "/skin Notch",
  "/skin AlexProgrammerDE",
  "/skin xknat",
  '/skin url "https://..."',
  "/skin random",
];

const guiFeatures = [
  "/skins",
  "Click to apply",
  "Browse skins",
  "Preview skins",
  "Favorites",
  "Search",
];

const features = [
  {
    Icon: Rocket,
    name: "Easy to use",
    description:
      "SkinsRestorer is easy to use, just install it and you're ready to go!",
    href: "/docs/installation",
    cta: "Install now",
    className: "col-span-3 lg:col-span-1",
    background: (
      <Ripple
        className="absolute -top-20 -right-20"
        mainCircleSize={180}
        mainCircleOpacity={0.1}
        numCircles={5}
      />
    ),
  },
  {
    Icon: Zap,
    name: "Change your skin",
    description:
      'Just run /skin <name> to change your skin! It\'s that easy!',
    href: "/docs",
    cta: "Learn more",
    className: "col-span-3 lg:col-span-2",
    background: (
      <AnimatedGridPattern
        numSquares={20}
        maxOpacity={0.08}
        duration={4}
        className="[mask-image:radial-gradient(600px_circle_at_100%_0%,white,transparent)]"
      />
    ),
  },
  {
    Icon: CloudDownload,
    name: "Restore your skins",
    description:
      "SkinsRestorer can restore your skins on offline mode servers!",
    className: "col-span-3 lg:col-span-2",
    background: <Meteors number={80} />,
  },
  {
    Icon: SiGithub,
    name: "Open Source",
    description:
      "SkinsRestorer is open source, you can contribute to it on GitHub!",
    href: process.env.NEXT_PUBLIC_GITHUB_LINK,
    cta: "View on GitHub",
    className: "col-span-3 lg:col-span-1",
    background: (
      <DotPattern
        width={24}
        height={24}
        cr={1.5}
        className="[mask-image:radial-gradient(500px_circle_at_0%_0%,white,transparent)]"
      />
    ),
  },
  {
    Icon: ImageIcon,
    name: "Use your own skin",
    description:
      'Use /skin url "<url>" to use a skin from the internet!',
    className: "col-span-3 lg:col-span-1",
    background: (
      <Marquee pauseOnHover className="absolute top-8 [--duration:20s]">
        {skinCommands.map((cmd) => (
          <div
            key={cmd}
            className="rounded-lg border bg-muted/50 px-3 py-2 text-xs font-medium"
          >
            {cmd}
          </div>
        ))}
      </Marquee>
    ),
  },
  {
    Icon: Grid3X3,
    name: "Use our GUI",
    description:
      "SkinsRestorer has a GUI to change your skin, just run /skins!",
    className: "col-span-3 lg:col-span-2",
    background: (
      <Marquee pauseOnHover className="absolute top-8 [--duration:20s]">
        {guiFeatures.map((feature) => (
          <div
            key={feature}
            className="rounded-lg border bg-muted/50 px-3 py-2 text-xs font-medium"
          >
            {feature}
          </div>
        ))}
      </Marquee>
    ),
  },
];

const faqItems: {
  question: string;
  answer: React.ReactNode;
}[] = [
  {
    question: "How do I install SkinsRestorer?",
    answer: (
      <>
        Download the latest release from{" "}
        <Link href="/docs/installation" className="underline text-primary">
          our installation guide
        </Link>{" "}
        and drop the plugin into your server&apos;s plugins folder. Restart the
        server, and you&apos;re good to go!
      </>
    ),
  },
  {
    question: "What platforms are supported?",
    answer:
      "SkinsRestorer supports Spigot, Paper, BungeeCord, Velocity, Fabric, and NeoForge. Check the installation docs for details on each platform.",
  },
  {
    question: "Is SkinsRestorer free?",
    answer: (
      <>
        Yes! SkinsRestorer is completely free and open source under the GPL-3.0
        license. You can view the source code on{" "}
        <a
          href={process.env.NEXT_PUBLIC_GITHUB_LINK}
          className="underline text-primary"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
  {
    question: "How do I change my skin?",
    answer:
      'Simply run /skin <name> to set your skin to any Minecraft player\'s skin, or use /skin url "<url>" to use a custom skin from the internet.',
  },
  {
    question: "Does it work on offline/cracked servers?",
    answer:
      "Yes! SkinsRestorer was specifically designed to restore skins on offline mode servers. Players can set their skins even without a premium Minecraft account.",
  },
  {
    question: "How do I use the skin GUI?",
    answer:
      "Run /skins in-game to open the graphical skin browser. You can browse, search, and apply skins with just a click.",
  },
];

export default function IndexPage() {
  return (
    <div className="px-4 pt-4 pb-6 w-full max-w-[1400px] mx-auto flex-1 md:pb-12">
      {/* Hero Section */}
      <section className="py-4 md:py-8">
        <div className="relative flex min-h-[600px] border rounded-2xl overflow-hidden bg-background">
          <HeroBackground />
          <div className="relative z-10 w-full px-4 md:px-8 lg:px-12 py-12 md:py-16">
            <div className="grid items-center gap-8 lg:gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              {/* Left column */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background/80 border border-primary/30 backdrop-blur-sm shadow-sm">
                  <Zap className="h-4 w-4 text-primary" />
                  <AnimatedShinyText className="text-sm font-semibold">
                    the most popular skin plugin for Minecraft
                  </AnimatedShinyText>
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                  Customize your Minecraft skin, anywhere.
                </h1>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="gap-2 h-14 px-8 text-lg font-semibold">
                    <Link href="/docs/installation">
                      <ChevronsRight className="h-6 w-6" />
                      Get Started
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="gap-2 h-14 px-8 text-lg font-semibold bg-background/80 backdrop-blur-sm border-2"
                  >
                    <a href={process.env.NEXT_PUBLIC_GITHUB_LINK}>
                      <SiGithub className="h-6 w-6" />
                      GitHub
                    </a>
                  </Button>
                </div>
              </div>
              {/* Right column */}
              <Suspense>
                <LatestRelease />
              </Suspense>
            </div>
          </div>
        </div>
        <p className="text-2xl md:text-3xl text-muted-foreground mt-8 w-full">
          <span className="text-primary font-semibold">Easy to use</span>,{" "}
          <span className="text-primary font-semibold">multi-platform</span>{" "}
          support,{" "}
          <span className="text-primary font-semibold">open source</span>, and{" "}
          <span className="text-primary font-semibold">free forever</span>.
          SkinsRestorer is the most popular skin plugin for Minecraft.
        </p>
      </section>

      {/* Features BentoGrid */}
      <section className="py-16" id="features">
        <div className="flex flex-col space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
            Features
          </h2>
          <p className="max-w-[700px] text-muted-foreground md:text-lg">
            Everything you need to manage skins on your Minecraft server.
          </p>
        </div>
        <BentoGrid className="auto-rows-[18rem] grid-cols-3 lg:grid-cols-3">
          {features.map((feature) => (
            <BentoCard key={feature.name} {...feature} />
          ))}
        </BentoGrid>
      </section>

      {/* FAQ Section */}
      <section className="py-16">
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex flex-col space-y-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="max-w-[700px] text-muted-foreground md:text-lg">
              Common questions about SkinsRestorer.
            </p>
          </div>
          <HomeFaq items={faqItems} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16">
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border bg-background px-8 py-16 md:py-24">
          <RetroGrid />
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Ready to Get Started?
            </h2>
            <p className="max-w-[600px] text-muted-foreground md:text-lg">
              Join thousands of server owners who trust SkinsRestorer to manage
              player skins across their networks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <Button asChild size="lg" className="gap-2 h-12 px-8">
                <Link href="/docs/installation">
                  <Download className="w-5 h-5" />
                  Get SkinsRestorer
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2 h-12 px-8">
                <a href={process.env.NEXT_PUBLIC_GITHUB_LINK}>
                  <SiGithub className="w-5 h-5" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16">
        <h2 className="text-center text-3xl md:text-4xl font-bold mb-12">
          Meet the team
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <TeamCard githubUsername="xknat" description="Developer" />
          <TeamCard githubUsername="AlexProgrammerDE" description="Developer" />
          <TeamCard
            githubUsername="aljaxus"
            description="System Administrator"
          />
        </div>
      </section>
    </div>
  );
}
