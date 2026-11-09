import { splitLocalePath, localizeHref } from "./i18n";
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

/** Retired pages that moved permanently. The query string is kept. */
const moved: Record<string, string> = { "/editor": "/studio" };

export function getSiteRedirect(pathname: string) {
  const { path, locale } = splitLocalePath(pathname);
  if (moved[path])
    return { destination: localizeHref(moved[path], locale), status: 308 };
  const markdown = path.endsWith(".mdx");
  const retired = docsRedirects.find(
    (item) => item.source === (markdown ? path.slice(0, -4) : path),
  );
  if (retired) {
    return {
      destination: localizeHref(
        `${retired.destination}${markdown ? ".mdx" : ""}`,
        locale,
      ),
      status: 308,
    };
  }
  if (aliases[path])
    return { destination: localizeHref(aliases[path], locale), status: 307 };
}
