import { lazy, useMemo } from "react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  redirect,
  useRouter,
  useRouterState,
  isNotFound,
  rootRouteId,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { LanguageSuggestion } from "@/components/language-suggestion";
import { ContentImage } from "@/components/content-image";
import { HomeLayout } from "@/components/home-layout";
import { LocaleLink } from "@/components/locale-link";
import NotFound from "@/components/not-found";
import { Button, buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  locales,
  localeNames,
  localizeHref,
  localizePath,
  splitLocalePath,
  isLocale,
  hasLocalizedPages,
  browserStorage,
} from "@/lib/i18n";
import { recordLanguageAnswer } from "@/lib/language-suggestion";
import { useLocale, useShownLocale, useT } from "@/lib/i18n-react";
import { LocaleProvider } from "@/lib/locale-provider";
import { fumadocsMessages } from "@/lib/messages/fumadocs";
import { hasMessages, loadMessages, translate } from "@/lib/messages";
import { siteTitleKey, siteUrl } from "@/lib/seo";
import { getSiteRedirect, redirectLocation } from "@/lib/site-redirects";
import "@/lib/analytics";
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
        href: redirectLocation(
          target.destination,
          new URL(location.href, siteUrl),
        ),
        statusCode: target.status,
      });
    }
    // Pages render in one language, so its catalog loads before they do.
    const { locale } = splitLocalePath(location.pathname);
    return hasMessages(locale) ? undefined : loadMessages(locale);
  },
  head: ({ matches }) => ({
    meta: [
      // oxlint-disable-next-line unicorn/text-encoding-identifier-case -- Keep the existing lowercase HTML encoding label.
      { charSet: "utf-8" },
      // Pages set their own title. This covers not-found and error states.
      { title: getFallbackTitle(matches) },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "application-name", content: "SkinsRestorer" },
      { name: "apple-mobile-web-app-title", content: "SkinsRestorer" },
      { name: "msapplication-TileColor", content: "#7113EC" },
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
  // gallery, would otherwise re-render the whole document. The URL changes
  // before its catalog loads, so keep the shown language until then.
  const locale = useShownLocale(
    useRouterState({
      select: (state) => splitLocalePath(state.location.pathname).locale,
    }),
  );
  const router = useRouter();
  const i18n = useMemo(
    () => ({
      locale,
      locales: localeOptions,
      translations: fumadocsMessages(locale),
      onLocaleChange: (next: string) => {
        if (!isLocale(next)) return;
        // A manual choice answers the browser-language offer for good.
        recordLanguageAnswer(browserStorage(), "chose");
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
        {/*
         * Brand purple, the same as the docs and the app's primary color.
         * HeadContent keeps one meta tag per name, so the light and dark
         * variants render here.
         */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#7113EC"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#CBA6F7"
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
              containerAriaLabel={translate(locale, "common.notifications")}
              toastOptions={{
                closeButtonAriaLabel: translate(
                  locale,
                  "common.closeNotification",
                ),
              }}
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
    ? `${translate(locale, "common.pageNotFound")} - SkinsRestorer`
    : translate(locale, siteTitleKey);
}

function ErrorPage({ reset }: ErrorComponentProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  return (
    <HomeLayout>
      <div className="m-auto flex max-w-xl flex-col items-center gap-6 px-4 py-12 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{t("errors.unexpectedTitle")}</h1>
          <p className="text-muted-foreground">
            {t("common.pleaseReloadPageTryAgain")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            {t("common.tryAgain")}
          </Button>
          {/* A full page load leaves the failed router state behind. */}
          <a
            href={localizeHref("/", locale)}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("common.backHome")}
          </a>
        </div>
      </div>
    </HomeLayout>
  );
}
