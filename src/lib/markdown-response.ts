import { docFileInfo, type Locale } from "./i18n";
import { getLLMText } from "./get-llm-text";
import { absoluteDocsUrl } from "./llm-markdown";
import { source } from "./source";

export async function markdownResponse(
  slug: string | undefined,
  request: Request,
  locale: Locale = "en",
) {
  const page = source.getPage(slug?.split("/").filter(Boolean), locale);
  if (!page) return new Response(null, { status: 404 });
  const contentLocale = docFileInfo(page.path).locale;
  // Point search engines at the HTML page in the language of this text, as
  // the HTML page's own canonical link does.
  const canonical = absoluteDocsUrl(page.url, contentLocale);
  return new Response(
    request.method === "HEAD" ? null : await getLLMText(page, request.signal),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Language": contentLocale,
        // Docs change only on deploy, like llms.txt.
        "Cache-Control": "public, max-age=3600",
        Link: `<${canonical}>; rel="canonical"`,
      },
    },
  );
}
