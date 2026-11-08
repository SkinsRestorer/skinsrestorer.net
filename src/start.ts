import { createMiddleware, createStart } from "@tanstack/react-start";
import { getSiteRedirect } from "@/lib/site-redirects";
import { securityHeaders } from "@/lib/security-headers";

const siteMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  const redirect = getSiteRedirect(url.pathname);
  if (redirect) {
    const destination = new URL(redirect.destination, url);
    destination.search = url.search;
    return new Response(null, {
      status: redirect.status,
      headers: { ...securityHeaders, Location: destination.href },
    });
  }
  const result = await next();
  for (const [name, value] of Object.entries(securityHeaders)) {
    result.response.headers.set(name, value);
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [siteMiddleware],
}));
