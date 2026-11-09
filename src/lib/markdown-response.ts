import { docFileInfo, type Locale } from "./i18n";
import { getLLMText } from "./get-llm-text";
import { source } from "./source";

export async function markdownResponse(
  slug: string | undefined,
  request: Request,
  locale: Locale = "en",
) {
  const page = source.getPage(slug?.split("/").filter(Boolean), locale);
  if (!page) return new Response(null, { status: 404 });
  return new Response(
    request.method === "HEAD" ? null : await getLLMText(page, request.signal),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Language": docFileInfo(page.path).locale,
      },
    },
  );
}
