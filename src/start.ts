import { splitLocalePath } from "@/lib/i18n";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { getSiteRedirect, redirectLocation } from "@/lib/site-redirects";
import { securityHeaders } from "@/lib/security-headers";

const siteMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  const redirect = getSiteRedirect(url.pathname);
  if (redirect) {
    const location = new URL(redirectLocation(redirect.destination, url), url);
    return new Response(null, {
      status: redirect.status,
      headers: { ...securityHeaders, Location: location.href },
    });
  }
  const result = await next();
  for (const [name, value] of Object.entries(securityHeaders)) {
    result.response.headers.set(name, value);
  }
  const { path, locale } = splitLocalePath(url.pathname);
  // Untranslated docs fall back to English, so only the HTML lang attribute
  // can name their language. Other localized pages always match their path.
  const mayFallBack =
    locale !== "en" && (path === "/docs" || path.startsWith("/docs/"));
  if (
    !mayFallBack &&
    result.response.headers.get("Content-Type")?.includes("text/html")
  ) {
    result.response.headers.set("Content-Language", locale);
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [siteMiddleware],
}));
