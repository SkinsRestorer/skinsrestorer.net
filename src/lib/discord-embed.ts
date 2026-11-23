import {
  ButtonStyle,
  ComponentType,
  type APIContainerComponent,
} from "discord-api-types/v10";

export interface DiscordEmbedOptions {
  title: string;
  label?: string;
  description?: string;
  url: string;
  images?: readonly string[];
  links?: readonly { label: string; url: string }[];
}

function shorten(value: string, length: number) {
  if (length <= 0) return "";
  const characters = Array.from(value);
  return characters.length > length
    ? `${characters.slice(0, length - 1).join("")}…`
    : value;
}

function markdown(value: string) {
  return value.replaceAll(/([\\`*_{}[\]()<>#|~])/gu, String.raw`\$1`);
}

function publicUrl(value: string, maximum = 512): string | undefined {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.href.length <= maximum
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function serializeDiscordEmbed(component: APIContainerComponent) {
  return JSON.stringify({ component }).replaceAll("<", String.raw`\u003c`);
}

export function createDiscordEmbed(
  options: DiscordEmbedOptions,
): APIContainerComponent | undefined {
  const url = publicUrl(options.url);
  if (!url) return undefined;
  let title = shorten(options.title.trim() || "View page", 120);
  let description = shorten(options.description?.trim() ?? "", 600);
  const images = (options.images ?? [])
    .flatMap((value) => publicUrl(value, 2048) ?? [])
    .slice(0, 4);
  const links = [
    { label: options.label ?? "View page", url },
    ...(options.links ?? []),
  ]
    .flatMap((link) => {
      const href = publicUrl(link.url);
      return href
        ? [{ label: shorten(link.label.trim() || "View page", 60), url: href }]
        : [];
    })
    .filter(
      (link, index, values) =>
        values.findIndex((other) => other.url === link.url) === index,
    )
    .slice(0, 4);

  for (;;) {
    const text = {
      type: ComponentType.TextDisplay,
      // URL.href keeps parentheses, which would end the Markdown link early.
      content: `## [${markdown(title)}](${url.replaceAll("(", "%28").replaceAll(")", "%29")})${description ? `\n${markdown(description)}` : ""}`,
    } as const;
    const component: APIContainerComponent = {
      type: ComponentType.Container,
      components: [
        text,
        ...(images.length > 0
          ? [
              {
                type: ComponentType.MediaGallery as const,
                items: images.map((image) => ({ media: { url: image } })),
              },
            ]
          : []),
        {
          type: ComponentType.ActionRow,
          components: links.map((link) => ({
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            ...link,
          })),
        },
      ],
    };
    if (
      new TextEncoder().encode(serializeDiscordEmbed(component)).byteLength <=
      3000
    )
      return component;
    if (images.length > 0) images.pop();
    else if (links.length > 1) links.pop();
    else if (description.length > 0)
      description = shorten(
        description,
        Math.floor(Array.from(description).length / 2),
      );
    else if (Array.from(title).length > 16) title = shorten(title, 16);
    else return undefined;
  }
}
