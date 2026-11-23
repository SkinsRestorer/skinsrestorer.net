import { Link } from "fumadocs-core/link";
import { createContext, useContext, type ComponentProps } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { ResolvedLink } from "@/lib/docs-links";

const PageLinksContext = createContext<Record<string, ResolvedLink>>({});

/** Provide the resolved targets of the links on the current page. */
export function PageLinks({
  links,
  children,
}: {
  links: Record<string, ResolvedLink>;
  children: React.ReactNode;
}) {
  return <PageLinksContext value={links}>{children}</PageLinksContext>;
}

/** Links to other docs pages show a preview of the target page. */
export function DocsLink({ href = "", ...props }: ComponentProps<"a">) {
  const found = useContext(PageLinksContext)[href];
  // The framework link localizes the href.
  if (!found) return <Link href={href} {...props} />;
  return (
    <HoverCard>
      <HoverCardTrigger render={<Link href={found.url} {...props} />} />
      <HoverCardContent className="text-sm">
        <p className="font-medium">{found.title}</p>
        <p className="text-fd-muted-foreground">{found.description}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
