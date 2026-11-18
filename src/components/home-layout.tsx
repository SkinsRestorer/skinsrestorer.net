import { useRouterState } from "@tanstack/react-router";
import { HomeLayout as FumadocsHomeLayout } from "fumadocs-ui/layouts/home";
import type { ComponentProps, ReactNode } from "react";
import { getBaseOptions } from "@/lib/layout-options";
import { useLocale, useT } from "@/lib/i18n-react";
import { localizeHref, splitLocalePath } from "@/lib/i18n";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

// Fumadocs renders its home container as <main>, which would put the header
// and footer inside the main landmark. A plain wrapper keeps the same id and
// layout classes so the header and footer stay top-level landmarks.
function LayoutContainer({
  className,
  ...props
}: Omit<ComponentProps<"main">, "ref">) {
  return (
    <div
      id="nd-home-layout"
      {...props}
      className={cn(
        "flex flex-1 flex-col [--fd-layout-width:1400px]",
        className,
      )}
    />
  );
}

const slots = { container: LayoutContainer };

export function HomeLayout({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const baseOptions = getBaseOptions(locale);
  const t = useT();
  const path = useRouterState({
    select: (state) => splitLocalePath(state.location.pathname).path,
  });
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-100 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t("common.skipToContent")}
      </a>
      <FumadocsHomeLayout
        {...baseOptions}
        slots={slots}
        // oxlint-disable-next-line typescript/no-deprecated -- the replacement is a custom slot; this prop hides the language switch on English-only pages
        i18n={
          !["/privacy-policy", "/terms-of-service", "/cookie-policy"].includes(
            path,
          )
        }
        links={[
          {
            type: "main",
            text: t("nav.documentation"),
            url: localizeHref("/docs", locale),
            description: t("common.installConfigureTroubleshootSkinsrestorer"),
          },
          {
            type: "main",
            text: t("nav.studio"),
            url: localizeHref("/studio", locale),
            active: "nested-url",
            description: t("common.editSkinsGetSkinUrlSrCreatecustom"),
          },
          {
            type: "main",
            text: t("nav.support"),
            url: localizeHref("/pricing", locale),
            description: t("common.optionalSupporterPlansDonations"),
          },
          ...(baseOptions.links ?? []),
        ]}
      >
        <main
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          {children}
        </main>
        <SiteFooter />
      </FumadocsHomeLayout>
    </>
  );
}
