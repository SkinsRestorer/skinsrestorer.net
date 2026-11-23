import { Card } from "fumadocs-ui/components/card";
import type { ComponentProps } from "react";

/**
 * Fumadocs gives card titles the same size as their descriptions. A larger,
 * bolder title lets readers scan a grid of cards.
 */
export function DocsCard({ title, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card
      {...props}
      title={<span className="text-base font-semibold">{title}</span>}
    />
  );
}
