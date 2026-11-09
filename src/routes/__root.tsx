import { lazy } from "react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { ContentImage } from "@/components/content-image";
import NotFound from "@/components/not-found";
import { Toaster } from "@/components/ui/sonner";
import {
  locales,
  localeNames,
  localizeHref,
  localizePath,
  splitLocalePath,
  isLocale,
} from "@/lib/i18n";
import { LocaleProvider, useLocale, useT } from "@/lib/i18n-react";
import { fumadocsMessages } from "@/lib/messages/fumadocs";
import { getSiteRedirect } from "@/lib/site-redirects";
import "@/lib/analytics";
import appCss from "../style.css?url";

const LocalizedSearchDialog = lazy(
  () => import("@/components/localized-search-dialog"),
);

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
      { property: "og:type", content: "website" },
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
  errorComponent: ErrorPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const locale = splitLocalePath(location.pathname).locale;
  return (
    <html lang={locale} suppressHydrationWarning>
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
        <LocaleProvider locale={locale}>
          <RootProvider
            components={{ Image: ContentImage, Link: LocaleLink }}
            i18n={{
              locale,
              locales: locales.map((code) => ({
                locale: code,
                name: localeNames[code],
              })),
              translations: fumadocsMessages(locale),
              onLocaleChange: (next) => {
                if (isLocale(next))
                  void navigate({ href: localizePath(location.href, next) });
              },
            }}
            search={{ SearchDialog: LocalizedSearchDialog }}
          >
            {children}
            <Toaster richColors />
            <CookieConsentBanner />
          </RootProvider>
        </LocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}

function LocaleLink({
  href = "",
  prefetch = true,
  ...props
}: React.ComponentProps<"a"> & { prefetch?: boolean }) {
  const locale = useLocale();
  return (
    <Link
      to={localizeHref(href, locale)}
      preload={prefetch ? "intent" : false}
      {...props}
    />
  );
}

function ErrorPage() {
  const t = useT();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-12">
      <h1 className="text-3xl font-bold">{t("Something went wrong")}</h1>
      <p>{t("Please reload the page to try again.")}</p>
    </main>
  );
}
