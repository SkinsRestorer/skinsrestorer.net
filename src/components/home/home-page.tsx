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
import { Link } from "fumadocs-core/link";
import { type ReactNode, useEffect, useState } from "react";
import { EnderDashSponsor } from "@/components/enderdash-sponsor";
import { Image } from "@/components/image";
import { Button } from "@/components/ui/button";
import { getLatestRelease } from "@/lib/release-server";
import styles from "./minecraft.module.css";
import { CopyCommand, HomeFaq } from "./home-interactions";
import { SkinStage } from "./skin-stage";
import { useT } from "@/lib/i18n-react";

const githubLink = "https://github.com/SkinsRestorer/SkinsRestorer";
const releasesLink = `${githubLink}/releases`;
const downloadLink =
  import.meta.env["VITE_MODRINTH_LINK"] ??
  "https://modrinth.com/plugin/skinsrestorer";
const discordLink = import.meta.env["VITE_DISCORD_LINK"] ?? "/discord";

const linkClassName =
  "inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline";
const inlineLinkClassName = "text-foreground underline underline-offset-4";

// GitHub redirects this to the newest release, so the link works before the tag loads.
const latestReleaseLink = `${releasesLink}/latest`;

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
      .catch(() => {});
    return () => {
      controller.abort();
    };
  }, []);

  // The label stays the same and the tag fills a reserved slot, so the row does not shift.
  return (
    <a href={data?.html_url ?? latestReleaseLink} className={linkClassName}>
      {t("home.latestRelease")}
      <span className="inline-block min-w-[8ch] font-mono text-xs text-muted-foreground tabular-nums">
        {data?.tag_name}
      </span>
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
    </a>
  );
}

const platformGroups = [
  {
    title: "home.pluginServers",
    detail: "home.putPluginJarServerSPluginsFolder",
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
      { label: "home.paperSpigotGuide", href: "/docs/installation/bukkit" },
    ],
  },
  {
    title: "home.proxyNetworks",
    detail: "home.installProxyEveryBackendServer",
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
      { label: "home.velocityGuide", href: "/docs/installation/velocity" },
      { label: "home.bungeecordGuide", href: "/docs/installation/bungeecord" },
    ],
  },
  {
    title: "home.moddedServers",
    detail: "home.putModServerSModsFolderPlayers",
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
      { label: "home.fabricGuide", href: "/docs/installation/fabric" },
      { label: "home.neoforgeGuide", href: "/docs/installation/neoforge" },
    ],
  },
] as const;

const commands = [
  {
    command: "/skin set <name>",
    example: "/skin set xknat",
    description: "home.wearSkinAnyMinecraftAccount",
    href: "/docs/features/change-skin",
  },
  {
    command: "/skin url <url>",
    example: '/skin url "https://skinsrestorer.net/skinsrestorer-skin.png"',
    description: "home.wearSkinPngLink",
    href: "/docs/features/skin-upload",
  },
  {
    command: "/skins",
    example: "/skins",
    description: "home.pickSkinGameMenu",
    href: "/docs/features/skin-menu",
  },
  {
    command: "/skin undo",
    example: "/skin undo",
    description: "home.goBackPreviousSkin",
    href: "/docs/features/skin-menu#reuse-a-previous-skin",
  },
  {
    command: "/skin update",
    example: "/skin update",
    description: "home.fetchLatestVersionAccountSkin",
    href: "/docs/features/change-skin#refresh-a-copied-account-skin",
  },
  {
    command: "/skin clear",
    example: "/skin clear",
    description: "home.useAccountSkinServerDefault",
    href: "/docs/features/change-skin#restore-your-account-skin",
  },
] as const;

const skinTools = [
  {
    title: "studio.title",
    description: "home.keepSkinsBrowserFixPaintThem2d",
    href: "/studio",
    action: "home.openStudio",
    icon: Palette,
  },
  {
    title: "home.uploadPng",
    description: "home.uploadSkinFileGetSkinUrlCommand",
    href: "/upload",
    action: "home.openUploader",
    icon: Upload,
  },
  {
    title: "home.saveNamedSkin",
    description: "home.serverStaffTurnPngIntoCommandSaves",
    href: "/generator",
    action: "home.openGenerator",
    icon: WandSparkles,
  },
] as const;

const team = [
  { username: "xknat", role: "common.developer" },
  { username: "AlexProgrammerDE", role: "common.developer" },
  { username: "aljaxus", role: "home.systemAdministrator" },
] as const;

function useFaqItems() {
  const t = useT();
  return [
    {
      question: t("home.skinsrestorerFree"),
      answer: t.rich("home.faqFreeAnswer", {
        // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
        github: <a className={inlineLinkClassName} href={githubLink} />,
        plans: <Link className={inlineLinkClassName} href="/pricing" />,
      }),
    },
    {
      question: t("home.doesWorkOnlineModeOfflineMode"),
      answer: t("home.yesOfflineModeServersBringsBackSkins"),
    },
    {
      question: t("home.doPlayersNeedInstallMod"),
      answer: t("home.noSkinsrestorerRunsOnlyServerProxyFabric"),
    },
    {
      question: t("home.howDoIUseSkinPngFile"),
      answer: t.rich("home.faqSkinFileAnswer", {
        upload: <Link className={inlineLinkClassName} href="/upload" />,
        command: <code>/skin url</code>,
        generator: <Link className={inlineLinkClassName} href="/generator" />,
      }),
    },
    {
      question: t("home.whereDoIGetHelpReportBug"),
      answer: t.rich("home.faqHelpAnswer", {
        guides: (
          <Link className={inlineLinkClassName} href="/docs/troubleshooting" />
        ),
        // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
        discord: <a className={inlineLinkClassName} href={discordLink} />,
        issues: (
          // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
          <a className={inlineLinkClassName} href={`${githubLink}/issues`} />
        ),
      }),
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
          className="text-3xl/tight font-semibold tracking-tight sm:text-4xl"
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
    <div className="flex w-full flex-col">
      <section
        aria-labelledby="home-title"
        className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-8 lg:pt-16 lg:pb-20"
      >
        <div className="flex flex-col items-start gap-6">
          <h1
            id="home-title"
            className="text-5xl/tight font-semibold tracking-tight text-balance sm:text-6xl xl:text-7xl"
          >
            {t("home.playerSkinsMinecraftServer")}
          </h1>
          <div className="flex max-w-lg flex-col gap-3 text-muted-foreground">
            <p className="text-lg/relaxed">
              {t("home.skinsrestorerFreePluginServerModShowsReal")}
            </p>
            <p className="text-sm">{t("home.worksWithPlatforms")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              render={
                <a href={downloadLink}>
                  <Download aria-hidden="true" />
                  {t("home.downloadModrinth")}
                </a>
              }
              nativeButton={false}
              size="lg"
            />
            <Button
              render={
                <Link href="/docs/installation">
                  <BookOpen aria-hidden="true" />
                  {t("common.installationGuide")}
                </Link>
              }
              nativeButton={false}
              size="lg"
              variant="outline"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>{t("home.openSourceGpl30")}</span>
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
            title={t("home.installServer")}
            action={
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Link
                  href="/docs/installation/requirements"
                  className={linkClassName}
                >
                  {t("home.minecraftJavaRequirements")}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
                <Link
                  href="/docs/installation/quick-start"
                  className={linkClassName}
                >
                  {t("home.checkFirstSkin")}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            }
          >
            {t("home.pickSoftwareServerRunsEachGuideCovers")}
          </SectionHeading>

          <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
            {platformGroups.map((group) => (
              <article
                key={group.title}
                className="flex flex-col gap-5 bg-background p-6"
              >
                <ul
                  aria-label={t("home.platformSoftware", {
                    platform: t(group.title),
                  })}
                  className="flex flex-wrap gap-x-2 gap-y-3"
                >
                  {group.software.map((software) => (
                    <li key={software.name}>
                      <Link
                        href={software.href}
                        className="flex min-w-16 flex-col items-center gap-2 text-xs font-medium"
                      >
                        <span
                          className={`${styles["slot"]} flex size-14 items-center justify-center`}
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
              {t("home.pluginFabricNeoforgeModsSeparateDownloadsModrinth")}
            </p>
            <a href={releasesLink} className={linkClassName}>
              {t("home.githubReleases")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="commands-title"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8"
      >
        <SectionHeading
          id="commands-title"
          title={t("home.commandsPlayers")}
          action={
            <Link
              href="/docs/reference/commands-permissions"
              className={linkClassName}
            >
              {t("home.allCommandsPermissions")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          }
        >
          {t("home.playersTypeTheseChatServerStaffDecide")}
        </SectionHeading>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
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
                <div className="col-start-1 row-start-2 flex min-w-0 flex-col gap-0.5 text-sm text-muted-foreground sm:col-start-2 sm:row-start-1">
                  <p>{t(item.description)}</p>
                  {item.example === item.command ? null : (
                    <p className="text-xs break-all">
                      {t("home.exampleLabel")}{" "}
                      <code className="font-mono text-foreground">
                        {item.example}
                      </code>
                    </p>
                  )}
                </div>
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
                className="group flex flex-col gap-3 rounded-lg border p-5 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <tool.icon aria-hidden="true" className="size-5 text-primary" />
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

      <section aria-labelledby="faq-title" className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start lg:px-8">
          <SectionHeading id="faq-title" title={t("home.questions")}>
            {t.rich("home.faqIntro", {
              docs: <Link href="/docs" className={inlineLinkClassName} />,
            })}
          </SectionHeading>
          <HomeFaq items={faqItems} />
        </div>
      </section>

      <section aria-labelledby="community-title" className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-start lg:px-8">
          <div className="flex flex-col items-start gap-6">
            <SectionHeading id="community-title" title={t("home.builtOpen")}>
              {t("home.bugReportsPullRequestsGoGithubQuestions")}
            </SectionHeading>
            <div className="flex flex-wrap gap-3">
              <Button
                render={
                  <a href={githubLink}>
                    <SiGithub aria-hidden="true" />
                    GitHub
                  </a>
                }
                nativeButton={false}
                variant="outline"
              />
              <Button
                render={
                  <a href={discordLink}>
                    <SiDiscord aria-hidden="true" />
                    Discord
                  </a>
                }
                nativeButton={false}
                variant="outline"
              />
            </div>
            <Link href="/pricing" className={linkClassName}>
              <Heart aria-hidden="true" className="size-4" />
              {t("pricing.becomeSupporter")}
            </Link>
            <EnderDashSponsor placement="home" className="w-full" />
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("home.maintainers")}
            </h3>
            <ul className="divide-y rounded-lg border">
              {team.map((member) => (
                <li key={member.username}>
                  <a
                    href={`https://github.com/${member.username}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <img
                      src={`https://github.com/${member.username}.png?size=80`}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
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
              {t("home.everyoneWhoContributed")}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
