import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;

  return (
    <HomeLayout
      {...baseOptions(lang)}
      links={[
        {
          type: "main",
          text: "Documentation",
          url: "/docs",
          description: "Learn how to use SkinsRestorer",
        },
        {
          type: "main",
          text: "Generator",
          url: "/generator",
          description: "Generate skin files for SkinsRestorer",
        },
        {
          type: "main",
          text: "Upload",
          url: "/upload",
          description: "Upload a PNG and get /skin url",
        },
        ...(baseOptions(lang).links || []),
      ]}
    >
      {children}
    </HomeLayout>
  );
}
