import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '~/app/layout.config';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return <HomeLayout {...baseOptions} links={[
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
    ...(baseOptions.links || []),
  ]}>{children}</HomeLayout>;
}
