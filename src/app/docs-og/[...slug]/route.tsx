import { generateOGImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";
import { i18n } from "@/lib/i18n";
import { getPageImage, source } from "@/lib/source";

export async function GET(
  _req: Request,
  { params }: RouteContext<"/docs-og/[...slug]">,
) {
  const { slug } = await params;

  // Check if first segment is a non-default locale
  let locale: (typeof i18n.languages)[number] = i18n.defaultLanguage;
  let pageSlug = slug.slice(0, -1); // remove "image.png"
  const firstSegment = pageSlug[0] as (typeof i18n.languages)[number];
  if (
    pageSlug.length > 0 &&
    i18n.languages.includes(firstSegment) &&
    firstSegment !== i18n.defaultLanguage
  ) {
    locale = firstSegment;
    pageSlug = pageSlug.slice(1);
  }

  const page = source.getPage(pageSlug, locale);
  if (!page) notFound();

  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: "SkinsRestorer",
  });
}

export function generateStaticParams() {
  return i18n.languages.flatMap((lang) =>
    source.getPages(lang).map((page) => ({
      slug: getPageImage(page).segments,
    })),
  );
}
