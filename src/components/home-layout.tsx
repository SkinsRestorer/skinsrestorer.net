import { HomeLayout as FumadocsHomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout-options";
import { SiteFooter } from "@/components/site-footer";

export function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <FumadocsHomeLayout
      {...baseOptions}
      links={[
        {
          type: "main",
          text: "Documentation",
          url: "/docs",
          description: "Install, configure, and troubleshoot SkinsRestorer",
        },
        {
          type: "main",
          text: "Skin generator",
          url: "/generator",
          description: "Generate a command to save a named skin on your server",
        },
        {
          type: "main",
          text: "Upload a skin",
          url: "/upload",
          description: "Get a /skin url command from a skin PNG",
        },
        {
          type: "main",
          text: "Support",
          url: "/pricing",
          description: "Optional supporter plans and donations",
        },
        ...(baseOptions.links || []),
      ]}
    >
      {children}
      <SiteFooter />
    </FumadocsHomeLayout>
  );
}
