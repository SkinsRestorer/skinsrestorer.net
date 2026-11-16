import { useRouterState } from "@tanstack/react-router";
import { HomeLayout as FumadocsHomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { getBaseOptions } from "@/lib/layout-options";
import { useLocale, useT } from "@/lib/i18n-react";
import { localizeHref, splitLocalePath } from "@/lib/i18n";
import { SiteFooter } from "@/components/site-footer";

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
          ...(baseOptions.links || []),
        ]}
      >
        {/* The skip link target. The header sits in the same <main>. */}
        <div
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          {children}
        </div>
        <SiteFooter />
      </FumadocsHomeLayout>
    </>
  );
}
