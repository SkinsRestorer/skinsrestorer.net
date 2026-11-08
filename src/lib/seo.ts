export const siteUrl = "https://skinsrestorer.net";
export const siteTitle = "SkinsRestorer - Minecraft Skin Plugin";
export const siteDescription =
  "SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins.";

export function getPageHead(
  path: string,
  options: { title?: string; description?: string; image?: string } = {},
) {
  const title = options.title ? `${options.title} - SR` : siteTitle;
  const description = options.description ?? siteDescription;
  const image = new URL(options.image ?? "/logo.png", siteUrl).href;
  const url = new URL(path, siteUrl).href;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
      {
        name: "twitter:card",
        content: options.image ? "summary_large_image" : "summary",
      },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
