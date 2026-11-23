import { splitLocalePath, localizeHref } from "./i18n";
import { docsRedirects } from "./docs-redirects";

const origin = "https://skinsrestorer.net";

const github =
  import.meta.env["VITE_GITHUB_LINK"] ??
  "https://github.com/SkinsRestorer/SkinsRestorer";

/**
 * Turn a link to this site into a path, so a shortcut such as /es/donate keeps
 * its locale even when the configured target is a full URL.
 */
function sitePath(href: string) {
  return href.startsWith(`${origin}/`) ? href.slice(origin.length) : href;
}

const aliases: Record<string, string> = {
  "/discord":
    import.meta.env["VITE_DISCORD_LINK"] ??
    "https://discord.com/invite/aKm3B52",
  "/github": github,
  "/spigot":
    import.meta.env["VITE_SPIGOT_LINK"] ??
    "https://www.spigotmc.org/resources/skinsrestorer.2124",
  "/donate": sitePath(import.meta.env["VITE_DONATE_LINK"] ?? "/pricing"),
  "/bstats":
    import.meta.env["VITE_BSTATS_LINK"] ??
    "https://bstats.org/plugin/bungeecord/SkinsRestorer/1686",
  "/modrinth":
    import.meta.env["VITE_MODRINTH_LINK"] ??
    "https://modrinth.com/plugin/skinsrestorer",
  "/perms": "/docs/reference/commands-permissions",
  "/skinurl": "/upload",
  "/skinedit": "/docs/features/skin-edit",
  "/firewall": "/docs/troubleshooting/firewall",
  // The Russian plugin locale up to 15.12.6 links this misspelling.
  "/firewal": "/docs/troubleshooting/firewall",
  "/install": "/docs/installation",
  "/contributors": `${github}/graphs/contributors`,
};

/** Retired pages that moved permanently. The query string is kept. */
const moved: Record<string, string> = { "/editor": "/studio" };

export interface SiteRedirect {
  destination: string;
  status: 307 | 308;
}

/**
 * The retired /llms.mdx/<slug> copies became /docs/<slug>.mdx. Return the new
 * path, or undefined for any other path.
 */
function movedMarkdown(path: string) {
  if (path !== "/llms.mdx" && !path.startsWith("/llms.mdx/")) return undefined;
  return `/docs${path.slice("/llms.mdx".length)}.mdx`;
}

export function getSiteRedirect(pathname: string): SiteRedirect | undefined {
  const { path: requested, locale } = splitLocalePath(pathname);
  if (moved[requested])
    return { destination: localizeHref(moved[requested], locale), status: 308 };
  const markdownMove = movedMarkdown(requested);
  const path = markdownMove ?? requested;
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
  if (markdownMove)
    return { destination: localizeHref(markdownMove, locale), status: 308 };
  if (aliases[path])
    return { destination: localizeHref(aliases[path], locale), status: 307 };
  return undefined;
}

/**
 * Build the Location of a redirect from the requested URL. A move on this site
 * keeps the request's query and hash. A link to another site, such as Discord,
 * gets neither, so texture links and other parameters stay on this site.
 * Destinations on this site are returned as a path.
 */
export function redirectLocation(destination: string, from: URL): string {
  const target = new URL(destination, from);
  if (target.origin !== from.origin) return target.href;
  if (from.search) target.search = from.search;
  if (from.hash) target.hash = from.hash;
  return `${target.pathname}${target.search}${target.hash}`;
}
