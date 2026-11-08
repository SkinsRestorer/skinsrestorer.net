import { docsRedirects } from "./docs-redirects";

const github =
  import.meta.env.VITE_GITHUB_LINK ??
  "https://github.com/SkinsRestorer/SkinsRestorer";

const aliases: Record<string, string> = {
  "/discord":
    import.meta.env.VITE_DISCORD_LINK ?? "https://discord.com/invite/aKm3B52",
  "/github": github,
  "/spigot":
    import.meta.env.VITE_SPIGOT_LINK ??
    "https://www.spigotmc.org/resources/skinsrestorer.2124",
  "/donate": import.meta.env.VITE_DONATE_LINK ?? "/pricing",
  "/bstats":
    import.meta.env.VITE_BSTATS_LINK ??
    "https://bstats.org/plugin/bungeecord/SkinsRestorer/1686",
  "/modrinth":
    import.meta.env.VITE_MODRINTH_LINK ??
    "https://modrinth.com/plugin/skinsrestorer",
  "/perms": "/docs/configuration/commands-permissions",
  "/skinurl": "/upload",
  "/skinedit": "/docs/features/skin-edit",
  "/unicode":
    "https://www.mobilefish.com/services/unicode_escape_sequence_converter/unicode_escape_sequence_converter.php",
  "/firewall": "/docs/troubleshooting/firewall",
  "/install": "/docs/installation",
  "/contributors": `${github}/graphs/contributors`,
  "/docs/troubleshooting/cannot-fetch-new-skins":
    "/docs/troubleshooting/firewall",
};

export function getSiteRedirect(pathname: string) {
  const path = pathname.replace(/\/$/, "") || "/";
  const markdown = path.endsWith(".mdx");
  const retired = docsRedirects.find(
    (item) => item.source === (markdown ? path.slice(0, -4) : path),
  );
  if (retired) {
    return {
      destination: `${retired.destination}${markdown ? ".mdx" : ""}`,
      status: 308,
    };
  }
  if (aliases[path]) return { destination: aliases[path], status: 307 };
}
