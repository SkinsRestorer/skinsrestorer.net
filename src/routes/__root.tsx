import { lazy, useMemo } from "react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  redirect,
  Link,
  useRouter,
  useRouterState,
  isNotFound,
  rootRouteId,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { LanguageSuggestion } from "@/components/language-suggestion";
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
  hasLocalizedPages,
} from "@/lib/i18n";
import { LocaleProvider, useLocale, useT } from "@/lib/i18n-react";
import { fumadocsMessages } from "@/lib/messages/fumadocs";
import { translate } from "@/lib/messages";
import { siteTitleKey } from "@/lib/seo";
import { getSiteRedirect } from "@/lib/site-redirects";
import "@/lib/analytics";
import "@/lib/stale-chunks";
import appCss from "../style.css?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";
import geistCyrillic from "@fontsource-variable/geist/files/geist-cyrillic-wght-normal.woff2?url";

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
  head: ({ matches }) => ({
    meta: [
      { charSet: "utf-8" },
      // Pages set their own title. This covers not-found and error states.
      { title: getFallbackTitle(matches) },
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
      // Body text uses Geist. Fetch the subsets this locale needs with the CSS.
      ...getFontPreloads(matches).map((href) => ({
        rel: "preload",
        href,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      })),
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

const localeOptions = locales.map((code) => ({
  locale: code,
  name: localeNames[code],
}));

function RootDocument({ children }: { children: React.ReactNode }) {
  // Select only the locale. Search changes, such as opening the Studio
  // gallery, would otherwise re-render the whole document.
  const locale = useRouterState({
    select: (state) => splitLocalePath(state.location.pathname).locale,
  });
  const router = useRouter();
  const i18n = useMemo(
    () => ({
      locale,
      locales: localeOptions,
      translations: fumadocsMessages(locale),
      onLocaleChange: (next: string) => {
        if (!isLocale(next)) return;
        const { href } = router.state.location;
        // English-only pages, such as legal text, have no localized URL.
        void router.navigate({
          href: localizePath(hasLocalizedPages(href) ? href : "/", next),
        });
      },
    }),
    [locale, router],
  );
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
            components={providerComponents}
            i18n={i18n}
            search={providerSearch}
          >
            {/* First in the Tab order, so keyboard users reach the choice first. */}
            <CookieConsentBanner />
            {children}
            {/* Top toasts start below the 56 px site header. */}
            <Toaster
              richColors
              offset={{ top: 72 }}
              mobileOffset={{ top: 64 }}
            />
            <LanguageSuggestion />
          </RootProvider>
        </LocaleProvider>
        <Scripts />
      </body>
    </html>
  );
}

const providerComponents = { Image: ContentImage, Link: LocaleLink };
const providerSearch = { SearchDialog: LocalizedSearchDialog };

function getFontPreloads(matches: readonly { pathname: string }[]) {
  const locale = splitLocalePath(matches.at(-1)?.pathname ?? "/").locale;
  return locale === "ru" ? [geistLatin, geistCyrillic] : [geistLatin];
}

function getFallbackTitle(
  matches: readonly { routeId: string; pathname: string; error: unknown }[],
) {
  const leaf = matches.at(-1);
  const locale = splitLocalePath(leaf?.pathname ?? "/").locale;
  const notFound =
    matches.some((match) => isNotFound(match.error)) ||
    leaf?.routeId === rootRouteId ||
    leaf?.routeId === "/{-$lang}";
  return notFound
    ? `${translate(locale, "common.pageNotFound")} - SR`
    : translate(locale, siteTitleKey);
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
      <h1 className="text-3xl font-bold">{t("errors.unexpectedTitle")}</h1>
      <p>{t("common.pleaseReloadPageTryAgain")}</p>
    </main>
  );
}
