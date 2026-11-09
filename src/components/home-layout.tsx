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
          text: t("Documentation"),
          url: localizeHref("/docs", locale),
          description: t("Install, configure, and troubleshoot SkinsRestorer"),
        },
        {
          type: "main",
          text: t("Skin generator"),
          url: localizeHref("/generator", locale),
          description: t(
            "Generate a command to save a named skin on your server",
          ),
        },
        {
          type: "main",
          text: t("Skin editor"),
          url: localizeHref("/editor", locale),
          description: t("Fix and paint a skin in 2D or 3D in your browser"),
        },
        {
          type: "main",
          text: t("Upload a skin"),
          url: localizeHref("/upload", locale),
          description: t("Get a /skin url command from a skin PNG"),
        },
        {
          type: "main",
          text: t("Support"),
          url: localizeHref("/pricing", locale),
          description: t("Optional supporter plans and donations"),
        },
        ...(baseOptions.links || []),
      ]}
    >
      {children}
      <SiteFooter />
    </FumadocsHomeLayout>
  );
}
