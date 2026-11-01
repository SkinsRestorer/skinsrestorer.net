import { createDiscordEmbed, serializeDiscordEmbed } from "@/lib/discord-embed";
import { getPageImage, source } from "@/lib/source";

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: page.slugs }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return new Response(null, { status: 404 });
  const url = new URL(page.url, "https://skinsrestorer.net").href;
  const component = createDiscordEmbed({
    title: page.data.title,
    description: `${page.data.description ?? ""}\nSkinsRestorer ${page.data.version} · ${page.data.appliesTo}\nReviewed ${page.data.reviewed}`,
    url,
    label: "Read guide",
    images: [new URL(getPageImage(page).url, "https://skinsrestorer.net").href],
    links: [
      {
        label: "Installation",
        url: "https://skinsrestorer.net/docs/installation",
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
}
