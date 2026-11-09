import { SiDiscord, SiGithub } from "@icons-pack/react-simple-icons";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Download,
  Heart,
  Palette,
  Upload,
  WandSparkles,
} from "lucide-react";
import Link from "fumadocs-core/link";
import { type ReactNode, useEffect, useState } from "react";
import { EnderDashSponsor } from "@/components/enderdash-sponsor";
import { Image } from "@/components/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLatestRelease } from "@/lib/release-server";
import styles from "./minecraft.module.css";
import { CopyCommand, HomeFaq } from "./home-interactions";
import { SkinStage } from "./skin-stage";
import { useT } from "@/lib/i18n-react";

const githubLink = "https://github.com/SkinsRestorer/SkinsRestorer";
const releasesLink = `${githubLink}/releases`;
const downloadLink =
  import.meta.env.VITE_MODRINTH_LINK ??
  "https://modrinth.com/plugin/skinsrestorer";
const discordLink = import.meta.env.VITE_DISCORD_LINK ?? "/discord";

const linkClassName =
  "inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline";

function LatestRelease() {
  const t = useT();
  const [data, setData] =
    useState<Awaited<ReturnType<typeof getLatestRelease>>>(null);
  useEffect(() => {
    const controller = new AbortController();
    void getLatestRelease({ signal: controller.signal })
      .then((release) => {
        if (!controller.signal.aborted) setData(release);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!data) return <ReleaseHistoryLink />;

  return (
    <a href={data.html_url} className={linkClassName}>
      {t("Release")} {data.tag_name}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

function ReleaseHistoryLink() {
  const t = useT();
  return (
    <a href={releasesLink} className={linkClassName}>
      {t("Release history")}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

const platformGroups = [
  {
    title: "Plugin servers",
    detail: "Put the plugin jar in the server’s plugins folder.",
    software: [
      {
        name: "Paper",
        image: "/platform/paper.png",
        href: "/docs/installation/bukkit",
      },
      {
        name: "Spigot",
        image: "/platform/spigot.png",
        href: "/docs/installation/bukkit",
      },
      {
        name: "Bukkit",
        image: "/platform/bukkit.png",
        href: "/docs/installation/bukkit",
      },
    ],
    guides: [
      { label: "Paper and Spigot guide", href: "/docs/installation/bukkit" },
    ],
  },
  {
    title: "Proxy networks",
    detail: "Install it on the proxy and on every backend server.",
    software: [
      {
        name: "Velocity",
        image: "/platform/velocity.svg",
        href: "/docs/installation/velocity",
      },
      {
        name: "BungeeCord",
        image: "/platform/bungeecord.png",
        href: "/docs/installation/bungeecord",
      },
    ],
    guides: [
      { label: "Velocity guide", href: "/docs/installation/velocity" },
      { label: "BungeeCord guide", href: "/docs/installation/bungeecord" },
    ],
  },
  {
    title: "Modded servers",
    detail: "Put the mod in the server’s mods folder. Players install nothing.",
    software: [
      {
        name: "Fabric",
        image: "/platform/fabric.png",
        href: "/docs/installation/fabric",
      },
      {
        name: "NeoForge",
        image: "/platform/neoforge.png",
        href: "/docs/installation/neoforge",
      },
    ],
    guides: [
      { label: "Fabric guide", href: "/docs/installation/fabric" },
      { label: "NeoForge guide", href: "/docs/installation/neoforge" },
    ],
  },
];

const commands = [
  {
    command: "/skin set <name>",
    example: "/skin set xknat",
    description: "Wear the skin of any Minecraft account.",
    href: "/docs/features/change-skin",
  },
  {
    command: "/skin url <url>",
    example: '/skin url "https://skinsrestorer.net/skinsrestorer-skin.png"',
    description: "Wear a skin from a PNG link.",
    href: "/docs/features/skin-upload",
  },
  {
    command: "/skins",
    example: "/skins",
    description: "Pick a skin from the in-game menu.",
    href: "/docs/features/skin-menu",
  },
  {
    command: "/skin undo",
    example: "/skin undo",
    description: "Go back to your previous skin.",
    href: "/docs/features/change-skin#undo-a-change",
  },
  {
    command: "/skin update",
    example: "/skin update",
    description: "Fetch the latest version of an account skin.",
    href: "/docs/features/change-skin#refresh-a-copied-account-skin",
  },
  {
    command: "/skin clear",
    example: "/skin clear",
    description: "Use your account skin or the server default.",
    href: "/docs/features/change-skin#restore-your-account-skin",
  },
];

const skinTools = [
  {
    title: "Skin Studio",
    description:
      "Keep skins in your browser, fix or paint them in 2D or 3D, and get a command for your server.",
    href: "/studio",
    action: "Open the Studio",
    icon: Palette,
  },
  {
    title: "Upload a PNG",
    description:
      "Upload a skin file and get a /skin url command that you can run in game.",
    href: "/upload",
    action: "Open the uploader",
    icon: Upload,
  },
  {
    title: "Save a named skin",
    description:
      "For server staff. Turn a PNG into a command that saves it under a name, so players can run /skin set with that name.",
    href: "/generator",
    action: "Open the generator",
    icon: WandSparkles,
  },
];

const team = [
  { username: "xknat", role: "Developer" },
  { username: "AlexProgrammerDE", role: "Developer" },
  { username: "aljaxus", role: "System administrator" },
];

function useFaqItems() {
  const t = useT();
  return [
    {
      question: t("Is SkinsRestorer free?"),
      answer: (
        <>
          {t(
            "Yes. It is free and licensed under GPL-3.0, and the source code is on",
          )}{" "}
          <a href={githubLink}>{t("GitHub")}</a>
          {t(". Paid")} <Link href="/pricing">{t("supporter plans")}</Link>{" "}
          {t("are optional. They come with priority help on Discord.")}
        </>
      ),
    },
    {
      question: t("Does it work in online mode and offline mode?"),
      answer: t(
        "Yes. On offline mode servers it brings back the skins of real accounts. In both modes, players can change their skin with commands.",
      ),
    },
    {
      question: t("Do players need to install a mod?"),
      answer: t(
        "No. SkinsRestorer runs only on the server or proxy. The Fabric and NeoForge versions are server-side mods too.",
      ),
    },
    {
      question: t("How do I use a skin from a PNG file?"),
      answer: (
        <>
          <Link href="/upload">{t("Upload the PNG")}</Link> {t("to get a")}{" "}
          <code>/skin url</code>{" "}
          {t("command, then run it in game. Server staff can use the")}{" "}
          <Link href="/generator">{t("skin generator")}</Link>{" "}
          {t("to save the skin under a name that every player can use.")}
        </>
      ),
    },
    {
      question: t("Where do I get help or report a bug?"),
      answer: (
        <>
          {t("Start with the")}{" "}
          <Link href="/docs/troubleshooting">
            {t("troubleshooting guides")}
          </Link>
          {t(". If that does not fix it, ask in")}{" "}
          <a href={discordLink}>{t("Discord")}</a>{" "}
          {t(
            "and include your server version and a recent log. Report bugs in the plugin on",
          )}{" "}
          <a href={`${githubLink}/issues`}>{t("GitHub issues")}</a>.
        </>
      ),
    },
  ];
}

function SectionHeading({
  id,
  title,
  children,
  action,
}: {
  id: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-xl flex-col gap-2">
        <h2
          id={id}
          className="font-(family-name:--font-geist-pixel-square) text-3xl leading-tight tracking-tight sm:text-4xl"
        >
          {title}
        </h2>
        <p className="text-muted-foreground">{children}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default function IndexPage() {
  const t = useT();
  const faqItems = useFaqItems();
  return (
    <div
      className={cn(
        "[--brand-ink:#7a720a] [--primary-foreground:#201e0b] [--primary:#d4c72e] [--ring:#b2a711] dark:[--brand-ink:#d4c72e]",
        "flex w-full flex-col",
      )}
    >
      <section
        aria-labelledby="home-title"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-8 lg:pt-16 lg:pb-20"
      >
        <div className="flex flex-col items-start gap-6">
          <p className="flex items-center gap-2.5 text-sm font-medium">
            <Image src="/logo.png" alt="" width={28} height={28} priority />
            {t("SkinsRestorer")}
          </p>
          <h1
            id="home-title"
            className="font-(family-name:--font-geist-pixel-square) text-5xl leading-none tracking-tight text-balance sm:text-6xl xl:text-7xl"
          >
            {t("Player skins for your Minecraft server")}
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            {t(
              "SkinsRestorer is a free plugin and server mod. It shows real skins on offline mode servers, and players can change their skin with one command.",
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              render={
                <a href={downloadLink}>
                  <Download aria-hidden="true" />
                  {t("Download on Modrinth")}
                </a>
              }
              nativeButton={false}
              size="lg"
            />
            <Button
              render={
                <Link href="/docs/installation">
                  <BookOpen aria-hidden="true" />
                  {t("Installation guide")}
                </Link>
              }
              nativeButton={false}
              size="lg"
              variant="outline"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>{t("Open source, GPL-3.0")}</span>
            <LatestRelease />
          </div>
        </div>
        <SkinStage />
      </section>

      <section
        id="installation"
        aria-labelledby="installation-title"
        className="scroll-mt-20 border-y bg-muted/40"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
          <SectionHeading
            id="installation-title"
            title={t("Install it on your server")}
            action={
              <Link
                href="/docs/installation/requirements"
                className={linkClassName}
              >
                {t("Minecraft and Java requirements")}
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          >
            {t(
              "Pick the software your server runs. Each guide covers where the file goes and how to check that it works.",
            )}
          </SectionHeading>

          <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
            {platformGroups.map((group) => (
              <article
                key={t(group.title)}
                className="flex flex-col gap-5 bg-background p-6"
              >
                <ul
                  aria-label={`${t(group.title)} software`}
                  className="flex flex-wrap gap-x-2 gap-y-3"
                >
                  {group.software.map((software) => (
                    <li key={software.name}>
                      <Link
                        href={software.href}
                        className="flex w-16 flex-col items-center gap-2 text-xs font-medium"
                      >
                        <span
                          className={`${styles.slot} flex size-14 items-center justify-center`}
                        >
                          <Image
                            src={software.image}
                            alt=""
                            width={40}
                            height={40}
                            className="size-9 object-contain"
                          />
                        </span>
                        {software.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-1 flex-col gap-1.5">
                  <h3 className="font-semibold">{t(group.title)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(group.detail)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {group.guides.map((guide) => (
                    <Link
                      key={guide.href}
                      href={guide.href}
                      className={linkClassName}
                    >
                      {t(guide.label)}
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-muted-foreground">
              {t(
                "The plugin and the Fabric and NeoForge mods are separate downloads. Modrinth and GitHub releases have every build.",
              )}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <a href={downloadLink} className={linkClassName}>
                {t("Modrinth")}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
              <a href={releasesLink} className={linkClassName}>
                {t("GitHub releases")}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="commands-title"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8"
      >
        <SectionHeading
          id="commands-title"
          title={t("Commands for players")}
          action={
            <Link
              href="/docs/configuration/commands-permissions"
              className={linkClassName}
            >
              {t("All commands and permissions")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          {t(
            "Players type these in chat. Server staff decide who can use each one with permissions.",
          )}
        </SectionHeading>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ul className="divide-y rounded-lg border">
            {commands.map((item) => (
              <li
                key={item.command}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
              >
                <Link
                  href={item.href}
                  className="w-fit font-mono text-sm font-medium underline-offset-4 hover:underline"
                >
                  {item.command}
                </Link>
                <p className="col-start-1 row-start-2 text-sm text-muted-foreground sm:col-start-2 sm:row-start-1">
                  {t(item.description)}
                </p>
                <div className="col-start-2 row-span-2 row-start-1 sm:col-start-3 sm:row-span-1">
                  <CopyCommand command={item.example} />
                </div>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {skinTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex flex-col gap-3 rounded-lg border p-5 transition-colors hover:border-(--brand-ink) hover:bg-muted/40"
              >
                <tool.icon
                  aria-hidden="true"
                  className="size-5 text-(--brand-ink)"
                />
                <div className="flex flex-1 flex-col gap-1.5">
                  <h3 className="font-semibold">{t(tool.title)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t(tool.description)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  {t(tool.action)}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="community-title" className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-start lg:px-8">
          <div className="flex flex-col items-start gap-6">
            <SectionHeading id="community-title" title={t("Built in the open")}>
              {t(
                "Bug reports and pull requests go to GitHub. Questions about setup or config get answered in Discord.",
              )}
            </SectionHeading>
            <div className="flex flex-wrap gap-3">
              <Button
                render={
                  <a href={githubLink}>
                    <SiGithub aria-hidden="true" />
                    {t("GitHub")}
                  </a>
                }
                nativeButton={false}
                variant="outline"
              />
              <Button
                render={
                  <a href={discordLink}>
                    <SiDiscord aria-hidden="true" />
                    {t("Discord")}
                  </a>
                }
                nativeButton={false}
                variant="outline"
              />
            </div>
            <Link href="/pricing" className={linkClassName}>
              <Heart aria-hidden="true" className="size-4" />
              {t("Become a supporter")}
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("Maintainers")}
            </h3>
            <ul className="divide-y rounded-lg border">
              {team.map((member) => (
                <li key={member.username}>
                  <a
                    href={`https://github.com/${member.username}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <img
                      src={`https://github.com/${member.username}.png`}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded-md"
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="text-sm font-medium">
                        {member.username}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {t(member.role)}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                  </a>
                </li>
              ))}
            </ul>
            <a
              href={`${githubLink}/graphs/contributors`}
              className={linkClassName}
            >
              {t("Everyone who contributed")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start lg:px-8">
          <SectionHeading id="faq-title" title={t("Questions")}>
            {t("Short answers. The")}{" "}
            <Link
              href="/docs"
              className="text-foreground underline underline-offset-4"
            >
              {t("documentation")}
            </Link>{" "}
            {t("has the details.")}
          </SectionHeading>
          <HomeFaq items={faqItems} />
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <EnderDashSponsor placement="home" className="border-t pt-8" />
      </div>
    </div>
  );
}
