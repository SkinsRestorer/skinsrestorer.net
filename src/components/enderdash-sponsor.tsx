import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function getEnderDashHref(placement: "home" | "docs-footer") {
  const url = new URL("https://enderdash.com");

  url.searchParams.set("utm_source", "skinsrestorer.net");
  url.searchParams.set("utm_medium", placement);
  url.searchParams.set("utm_campaign", "sponsored-shoutout");

  return url.toString();
}

export function EnderDashSponsor({
  placement,
  className,
}: {
  placement: "home" | "docs-footer";
  className?: string;
}) {
  const href = getEnderDashHref(placement);

  if (placement === "docs-footer") {
    return (
      <aside
        className={cn(
          "flex flex-wrap items-center gap-3 border-t py-4 text-sm text-muted-foreground",
          className,
        )}
        aria-label="Sponsor"
      >
        <Image
          src="/assets/sponsors/enderdash-logo.png"
          alt=""
          width={24}
          height={24}
        />
        <p>
          Sponsored by{" "}
          <a
            href={href}
            target="_blank"
            rel="sponsored noopener"
            className="font-medium text-foreground underline underline-offset-4"
          >
            EnderDash
          </a>
          , a dashboard for Minecraft server administration.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6",
        className,
      )}
      aria-label="Sponsor"
    >
      <Image
        src="/assets/sponsors/enderdash-logo.png"
        alt=""
        width={40}
        height={40}
        className="shrink-0"
      />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground">Sponsor: EnderDash</p>
        <p className="text-sm text-muted-foreground">
          Run server commands, read logs, and manage files in your browser.
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener"
        className="inline-flex items-center gap-2 text-sm font-medium hover:underline underline-offset-4"
      >
        enderdash.com
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </aside>
  );
}
