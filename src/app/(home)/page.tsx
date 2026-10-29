import { SiDiscord, SiGithub } from "@icons-pack/react-simple-icons";
import type { paths } from "@octokit/openapi-types";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Download,
  Heart,
  Upload,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { EnderDashSponsor } from "@/components/enderdash-sponsor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyCommand, HomeFaq } from "./page.client";
import styles from "./page.module.css";

const githubLink = "https://github.com/SkinsRestorer/SkinsRestorer";
const downloadLink =
  process.env.NEXT_PUBLIC_MODRINTH_LINK ??
  "https://modrinth.com/plugin/skinsrestorer";
const discordLink = process.env.NEXT_PUBLIC_DISCORD_LINK ?? "/discord";

type LatestReleaseResponse =
  paths["/repos/{owner}/{repo}/releases/latest"]["get"]["responses"]["200"]["content"]["application/json"];

async function LatestRelease() {
  let data: LatestReleaseResponse | null = null;

  try {
    const response = await fetch(
      "https://api.github.com/repos/SkinsRestorer/SkinsRestorer/releases/latest",
      { next: { revalidate: 120 } },
    );
    if (response.ok) data = await response.json();
  } catch {
    // Downloads and installation guides remain available if GitHub is offline.
  }

  return (
    <a
      href={data?.html_url ?? `${githubLink}/releases`}
      className={styles.textLink}
    >
      {data ? `Latest version: ${data.tag_name}` : "Release history"}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

const serverSoftware = {
  paper: {
    name: "Paper",
    image: "/platform/paper.png",
    href: "/docs/installation/bukkit",
  },
  spigot: {
    name: "Spigot",
    image: "/platform/spigot.png",
    href: "/docs/installation/bukkit",
  },
  bukkit: {
    name: "Bukkit",
    image: "/platform/bukkit.png",
    href: "/docs/installation/bukkit",
  },
  velocity: {
    name: "Velocity",
    image: "/platform/velocity.svg",
    href: "/docs/installation/velocity",
  },
  bungeecord: {
    name: "BungeeCord",
    image: "/platform/bungeecord.png",
    href: "/docs/installation/bungeecord",
  },
  fabric: {
    name: "Fabric",
    image: "/platform/fabric.png",
    href: "/docs/installation/fabric",
  },
  neoforge: {
    name: "NeoForge",
    image: "/platform/neoforge.png",
    href: "/docs/installation/neoforge",
  },
};

function PlatformLogo({
  software,
}: {
  software: (typeof serverSoftware)[keyof typeof serverSoftware];
}) {
  return (
    <Image
      src={software.image}
      alt=""
      width={40}
      height={40}
      className={styles.platformLogo}
      data-platform={software.name}
    />
  );
}

const platforms = [
  {
    software: [
      serverSoftware.paper,
      serverSoftware.spigot,
      serverSoftware.bukkit,
    ],
    title: "Bukkit servers",
    description: "Paper, Spigot, Bukkit",
    detail: "Install the plugin in your server’s plugins folder.",
    links: [{ label: "Installation guide", href: "/docs/installation/bukkit" }],
  },
  {
    software: [serverSoftware.velocity, serverSoftware.bungeecord],
    title: "Proxy servers",
    description: "Velocity, BungeeCord",
    detail: "Install SkinsRestorer on the proxy and each backend server.",
    links: [
      { label: "Velocity guide", href: "/docs/installation/velocity" },
      { label: "BungeeCord guide", href: "/docs/installation/bungeecord" },
    ],
  },
  {
    software: [serverSoftware.fabric, serverSoftware.neoforge],
    title: "Server mods",
    description: "Fabric, NeoForge",
    detail: "Download the mod for your loader and Minecraft version.",
    links: [
      { label: "Fabric guide", href: "/docs/installation/fabric" },
      { label: "NeoForge guide", href: "/docs/installation/neoforge" },
    ],
  },
];

const commands = [
  {
    command: "/skin set xknat",
    title: "Change your skin",
    description: "Use a Minecraft player name to apply that account’s skin.",
    href: "/docs/features/change-skin",
    label: "Change a skin",
  },
  {
    command: "/skins",
    title: "Browse skins",
    description: "Choose a skin from the in-game menu on supported platforms.",
    href: "/docs/features/skin-menu",
    label: "Skin menu guide",
  },
  {
    command: "/skin clear",
    title: "Reset your skin",
    description:
      "Clear your selection to use your account skin or the server default.",
    href: "/docs/features/change-skin#restore-your-account-skin",
    label: "Reset command",
  },
];

const team = [
  { username: "xknat", role: "Developer" },
  { username: "AlexProgrammerDE", role: "Developer" },
  { username: "aljaxus", role: "System administrator" },
];

const faqItems = [
  {
    question: "Is the plugin free?",
    answer: (
      <>
        Yes. SkinsRestorer is free under the GPL-3.0 license. The source code is
        on <a href={githubLink}>GitHub</a>. Paid{" "}
        <Link href="/pricing">supporter plans</Link> are optional and include
        priority Discord support.
      </>
    ),
  },
  {
    question: "Does it support online and offline mode?",
    answer:
      "Yes. It restores account skins on offline mode servers and supports skin changes in both modes.",
  },
  {
    question: "Do players need a client mod?",
    answer:
      "No. Install SkinsRestorer on the server or proxy. The Fabric and NeoForge versions also run on the server.",
  },
  {
    question: "How do I use a PNG skin?",
    answer: (
      <>
        <Link href="/upload">Upload a PNG</Link> to get a <code>/skin url</code>{" "}
        command, then run it in game. Administrators can use the{" "}
        <Link href="/generator">custom skin generator</Link> to get a command
        that saves the skin under a name on the server.
      </>
    ),
  },
  {
    question: "How do I report a problem?",
    answer: (
      <>
        Read the{" "}
        <Link href="/docs/troubleshooting">troubleshooting guides</Link> for
        known problems. For support, post your server details and a recent log
        in <a href={discordLink}>Discord</a>. Report plugin bugs through{" "}
        <a href={`${githubLink}/issues`}>GitHub issues</a>.
      </>
    ),
  },
];

export default function IndexPage() {
  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.projectName}>
            <Image src="/logo.png" alt="" width={24} height={24} />
            SkinsRestorer
          </p>
          <h1 id="home-title">
            Change skins
            <br />
            <span>on your server</span>
          </h1>
          <p className={styles.intro}>
            SkinsRestorer restores skins on offline mode servers. Players can
            change skins using a Minecraft player name or a custom PNG.
          </p>
          <div className={styles.heroActions}>
            <Button asChild size="lg">
              <a href="#installation">
                <Download aria-hidden="true" />
                Install SkinsRestorer
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">
                <BookOpen aria-hidden="true" />
                Documentation
              </Link>
            </Button>
          </div>
          <p className={styles.heroNote}>Free and open source under GPL-3.0.</p>
        </div>
        <div className={styles.skinShowcase}>
          <div className={styles.skinStage}>
            <div className={styles.skinBackdrop} aria-hidden="true" />
            <Image
              src="/skinsrestorer-character.png"
              alt="Minecraft character with a custom skin"
              width={640}
              height={760}
              className={styles.character}
              preload
            />
          </div>
          <div className={styles.heroCommand}>
            <div className={styles.commandLine}>
              <code>/skin set xknat</code>
              <CopyCommand command="/skin set xknat" />
            </div>
            <p>Replace xknat with a Minecraft player name.</p>
          </div>
        </div>
      </section>

      <div className={styles.compatibility}>
        <p>Supported platforms</p>
        <ul aria-label="Supported platforms">
          {Object.values(serverSoftware).map((software) => (
            <li key={software.name}>
              <Link href={software.href}>
                <PlatformLogo software={software} />
                <span>{software.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <a href="#installation" aria-label="Installation guides">
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>
      </div>

      <section className={styles.section} aria-labelledby="skins-title">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="skins-title">Skin commands</h2>
            <p>Run these in game on a server with SkinsRestorer.</p>
          </div>
          <Link href="/docs/features" className={styles.textLink}>
            Feature documentation{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className={styles.commandGrid}>
          {commands.map((item) => (
            <Card key={item.command}>
              <CardHeader className="flex-1">
                <CardTitle>
                  <h3>{item.title}</h3>
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={styles.commandLine}>
                  <code>{item.command}</code>
                  <CopyCommand command={item.command} />
                </div>
              </CardContent>
              <CardFooter>
                <Link href={item.href} className={styles.textLink}>
                  {item.label}{" "}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
        <div className={styles.toolsRow}>
          <Upload aria-hidden="true" className="size-5 shrink-0" />
          <p>
            <strong>PNG skins.</strong> Get a <code>/skin url</code> command for
            your image.
          </p>
          <Link href="/upload" className={styles.textLink}>
            Upload a PNG <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href="/generator" className={styles.textLink}>
            Custom skin generator{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <section
        id="installation"
        className={styles.installSection}
        aria-labelledby="installation-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="installation-title">Install SkinsRestorer</h2>
            <p>Select your server software for installation instructions.</p>
          </div>
          <Suspense
            fallback={
              <a href={`${githubLink}/releases`} className={styles.textLink}>
                Release history{" "}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            }
          >
            <LatestRelease />
          </Suspense>
        </div>
        <div className={styles.platformGrid}>
          {platforms.map((platform) => (
            <article key={platform.title} className={styles.platform}>
              <div className={styles.platformLogos} aria-hidden="true">
                {platform.software.map((software) => (
                  <PlatformLogo key={software.name} software={software} />
                ))}
              </div>
              <h3>{platform.title}</h3>
              <p className={styles.platformNames}>{platform.description}</p>
              <p>{platform.detail}</p>
              <div className={styles.platformLinks}>
                {platform.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.textLink}
                  >
                    {link.label}{" "}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
        <div className={styles.installFooter}>
          <p>
            <a href={downloadLink}>Download from Modrinth</a>
          </p>
          <Link
            href="/docs/installation/requirements"
            className={styles.textLink}
          >
            Minecraft and Java requirements{" "}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </section>

      <section className={styles.community} aria-labelledby="community-title">
        <div className={styles.communityCopy}>
          <SiGithub aria-hidden="true" className="size-7" />
          <h2 id="community-title">Contribute to SkinsRestorer</h2>
          <p>
            Report bugs and submit changes on GitHub. For installation or
            configuration questions, ask in our Discord server.
          </p>
          <div className={styles.communityActions}>
            <Button asChild variant="outline">
              <a href={githubLink}>
                <SiGithub aria-hidden="true" />
                GitHub repository
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={discordLink}>
                <SiDiscord aria-hidden="true" />
                Discord support
              </a>
            </Button>
          </div>
          <Link href="/pricing" className={styles.textLink}>
            <Heart aria-hidden="true" className="size-4" />
            Support development
          </Link>
        </div>
        <div className={styles.team}>
          <h3>Project team</h3>
          {team.map((member) => (
            <a
              key={member.username}
              href={`https://github.com/${member.username}`}
            >
              <Image
                src={`https://github.com/${member.username}.png`}
                alt=""
                width={44}
                height={44}
                className="rounded-md"
              />
              <div>
                <span>{member.username}</span>
                <p>{member.role}</p>
              </div>
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
          ))}
          <a
            href={`${githubLink}/graphs/contributors`}
            className={styles.textLink}
          >
            All contributors{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </section>

      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div>
          <h2 id="faq-title">Frequently asked questions</h2>
          <Link href="/docs" className={styles.textLink}>
            Documentation <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <HomeFaq items={faqItems} />
      </section>

      <EnderDashSponsor placement="home" className={styles.sponsor} />
    </div>
  );
}
