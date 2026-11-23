import { Link } from "fumadocs-core/link";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { ArrowUpRight, Search } from "lucide-react";
import { HomeLayout } from "@/components/home-layout";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-react";
import type { MessageKey } from "@/lib/messages";

const popularPages: { href: string; label: MessageKey; external?: true }[] = [
  { href: "/docs/installation", label: "common.installationGuide" },
  { href: "/docs/troubleshooting", label: "notfound.troubleshooting" },
  { href: "/studio", label: "nav.studio" },
  { href: "/discord", label: "notfound.askOnDiscord", external: true },
];

const popularLinkClassName =
  "inline-flex items-center gap-0.5 underline underline-offset-4 hover:text-primary";

export default function RootComponent() {
  const t = useT();
  const { enabled: searchEnabled, setOpenSearch } = useSearchContext();
  return (
    <HomeLayout>
      {/* The root route head sets the page title. */}
      <meta name="robots" content="noindex" />
      <div className="m-auto flex max-w-xl flex-col items-center gap-6 px-4 py-12 text-center">
        <picture>
          <source
            media="(prefers-reduced-motion: reduce)"
            srcSet="/nyan-cat-still.webp"
          />
          <img
            src="/nyan-cat.webp"
            alt=""
            width={476}
            height={280}
            className="h-auto w-full max-w-64 rounded-xl"
          />
        </picture>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{t("common.404PageNotFound")}</h1>
          <p className="text-muted-foreground">{t("notfound.description")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {searchEnabled ? (
            <Button
              type="button"
              onClick={() => {
                setOpenSearch(true);
              }}
            >
              <Search aria-hidden="true" />
              {t("notfound.searchDocumentation")}
            </Button>
          ) : null}
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant={searchEnabled ? "outline" : "default"}
          >
            {t("common.backHome")}
          </Button>
        </div>
        <nav
          aria-labelledby="not-found-popular"
          className="flex flex-col items-center gap-2"
        >
          <h2
            id="not-found-popular"
            className="text-sm font-medium text-muted-foreground"
          >
            {t("notfound.popularPages")}
          </h2>
          <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            {popularPages.map((page) => (
              <li key={page.href}>
                {page.external ? (
                  <a href={page.href} className={popularLinkClassName}>
                    {t(page.label)}
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </a>
                ) : (
                  <Link href={page.href} className={popularLinkClassName}>
                    {t(page.label)}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </HomeLayout>
  );
}
