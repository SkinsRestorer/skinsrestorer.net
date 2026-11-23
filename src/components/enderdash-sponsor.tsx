import { useT } from "@/lib/i18n-react";
import { Image } from "@/components/image";
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
  const t = useT();
  const href = getEnderDashHref(placement);

  return (
    <aside
      className={cn(
        "flex flex-wrap items-center gap-3 border-t py-4 text-sm text-muted-foreground",
        className,
      )}
      aria-label={t("common.sponsor")}
    >
      <Image
        src="/assets/sponsors/enderdash-logo.png"
        alt=""
        width={24}
        height={24}
      />
      <p>
        {t.rich("common.sponsoredByEnderDash", {
          link: (
            // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- t.rich fills in the link text.
            <a
              href={href}
              target="_blank"
              rel="sponsored noopener"
              className="font-medium text-foreground underline underline-offset-4"
            />
          ),
        })}
      </p>
    </aside>
  );
}
