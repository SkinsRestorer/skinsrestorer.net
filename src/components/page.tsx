
import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/page';

export function Page({
  children,
  ...props
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DocsLayout
      {...props}
      toc={{
        enabled: false,
      }}
    >
      <main className="prose p-4 dark:prose-invert">{children}</main>
    </DocsLayout>
  );
}
