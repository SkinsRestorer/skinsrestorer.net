import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sponsorHighlights = [
  "Run commands with tab completion",
  "Read logs and manage files",
  "Invite your whole team",
  "Manage players with Ocelot AI",
] as const;

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
          "mt-8 rounded-xl border border-primary/20 bg-card/60 p-4 shadow-sm",
          className,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-background p-2">
              <Image
                src="/assets/sponsors/enderdash-logo.png"
                alt="EnderDash logo"
                width={56}
                height={56}
                className="h-auto w-full"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Partnered
              </p>
              <p className="font-semibold">
                Need a more capable admin panel for your server?
              </p>
              <p className="text-sm text-muted-foreground">
                EnderDash adds an advanced dashboard to your existing Minecraft
                servers with a single plugin, batteries included.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2 sm:self-start">
            <a href={href} target="_blank" rel="noopener">
              Check out EnderDash
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-primary/20 bg-card px-6 py-8 shadow-sm sm:px-8 lg:px-10",
        className,
      )}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">
              Partnered
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Advanced administration for Minecraft servers without replacing
              your stack.
            </h2>
            <p className="max-w-3xl text-muted-foreground">
              EnderDash lets you manage your existing Minecraft servers from one
              dashboard by installing a single plugin. Run commands, read logs,
              manage files, invite your whole team, manage players, and keep
              Ocelot close at hand without changing your current infrastructure
              or panel.
            </p>
          </div>

          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {sponsorHighlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="gap-2 sm:w-fit">
              <a href={href} target="_blank" rel="noopener">
                Visit EnderDash
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </Button>
            <p className="text-sm text-muted-foreground">
              Works with existing infrastructure and panels.
            </p>
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="mx-auto flex w-full max-w-[180px] items-center justify-center rounded-2xl border bg-background p-6 transition-colors hover:bg-muted/40"
        >
          <Image
            src="/assets/sponsors/enderdash-logo.png"
            alt="EnderDash logo"
            width={144}
            height={144}
            className="h-auto w-full"
            priority
          />
        </a>
      </div>
    </section>
  );
}
