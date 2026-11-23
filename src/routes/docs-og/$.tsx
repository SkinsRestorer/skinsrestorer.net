import { isLocale } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/docs-og/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const [{ generateDocsImage }, { getPageImage, source }] =
          await Promise.all([import("@/lib/docs-og"), import("@/lib/source")]);
        const segments = params._splat?.split("/") ?? [];
        if (segments.pop() !== "image.png")
          return new Response(null, { status: 404 });
        const locale = isLocale(segments[0]) ? segments.shift() : "en";
        const page = source.getPage(segments, locale);
        if (!page) return new Response(null, { status: 404 });
        // Aliases such as /docs-og/en/... or an untranslated locale share one
        // image, so they redirect instead of rendering it again. An untranslated
        // page can gain its own image later, so that redirect is temporary.
        const url = new URL(request.url);
        const canonical = new URL(getPageImage(page).url, url);
        if (url.pathname !== canonical.pathname)
          return new Response(null, {
            status: locale === "en" ? 301 : 302,
            headers: { Location: canonical.href },
          });
        return generateDocsImage(canonical.href, {
          title: page.data.title,
          description: page.data.description,
        });
      },
    },
  },
});
