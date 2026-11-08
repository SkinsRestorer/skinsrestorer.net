import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ContentImage } from "@/components/content-image";
import NotFound from "@/components/not-found";
import { Toaster } from "@/components/ui/sonner";
import { getPageHead } from "@/lib/seo";
import { getSiteRedirect } from "@/lib/site-redirects";
import "@/lib/analytics";
import appCss from "../style.css?url";

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const target = getSiteRedirect(location.pathname);
    if (target) {
      throw redirect({
        href: `${target.destination}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
        statusCode: target.status,
      });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#B2A711" },
      { name: "application-name", content: "SkinsRestorer" },
      { name: "apple-mobile-web-app-title", content: "SkinsRestorer" },
      { name: "msapplication-TileColor", content: "#B2A711" },
      { property: "og:site_name", content: "SkinsRestorer" },
      { property: "og:locale", content: "en_US" },
      { property: "og:type", content: "website" },
      ...getPageHead("/").meta,
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", href: "/icon.png" },
      { rel: "apple-touch-icon", href: "/apple-icon.png" },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: () => (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p>Please reload the page to try again.</p>
    </main>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="aer4SuKmVEAedLgr3jfsYA"
          async
        />
      </head>
      <body
        className="flex size-full min-h-svh flex-col font-sans antialiased"
        suppressHydrationWarning
      >
        <RootProvider
          components={{ Image: ContentImage }}
          search={{ options: { type: "static" } }}
        >
          {children}
          <Toaster richColors />
          <CookieConsentBanner />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
