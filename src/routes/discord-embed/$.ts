import { isLocale, localizePath } from "@/lib/i18n";
import { translate } from "@/lib/messages";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/discord-embed/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const [
          { createDiscordEmbed, serializeDiscordEmbed },
          { getPageImage, source },
        ] = await Promise.all([
          import("@/lib/discord-embed"),
          import("@/lib/source"),
        ]);
        const slugs = params._splat?.split("/").filter(Boolean) ?? [];
        const locale = isLocale(slugs[0]) ? slugs.shift()! : "en";
        if (!isLocale(locale)) return new Response(null, { status: 404 });
        const page = source.getPage(slugs, locale);
        if (!page) return new Response(null, { status: 404 });
        const component = createDiscordEmbed({
          title: page.data.title,
          description: `${page.data.description ?? ""}\nSkinsRestorer ${page.data.version} · ${page.data.appliesTo}\nReviewed ${page.data.reviewed}`,
          url: new URL(page.url, "https://skinsrestorer.net").href,
          label: translate(locale, "common.readGuide"),
          images: [
            new URL(getPageImage(page).url, "https://skinsrestorer.net").href,
          ],
          links: [
            {
              label: translate(locale, "common.installationGuide"),
              url: new URL(
                localizePath("/docs/installation", locale),
                "https://skinsrestorer.net",
              ).href,
            },
          ],
        });
        if (!component) return new Response(null, { status: 404 });
        return new Response(serializeDiscordEmbed(component), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
