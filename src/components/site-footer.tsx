import { useState } from "react";
import { Link } from "fumadocs-core/link";
import { ArrowUpRight } from "lucide-react";
import { CookieSettingsButton } from "@/components/cookie-consent-banner";
import { useT } from "@/lib/i18n-react";

export function SiteFooter() {
  const t = useT();
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [year] = useState(() => new Date().getFullYear());

  return (
    <footer className="mt-auto border-t py-6 text-sm text-fd-muted-foreground">
      <div className="mx-auto flex w-full max-w-(--fd-layout-width) flex-col items-center gap-3 px-4 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
        <p>
          &copy;{" "}
          {/* The prerendered year can lag the client year until the next deploy. */}
          <span suppressHydrationWarning>{year}</span> SkinsRestorer
        </p>
        <nav
          aria-label={t("footer.footer")}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 sm:gap-y-2"
        >
          <Link href="/terms-of-service" className="hover:text-fd-foreground">
            {t("common.termsService")}
          </Link>
          <Link href="/privacy-policy" className="hover:text-fd-foreground">
            {t("common.privacyPolicy")}
          </Link>
          <Link href="/cookie-policy" className="hover:text-fd-foreground">
            {t("common.cookiePolicy")}
          </Link>
          <CookieSettingsButton className="hover:text-fd-foreground" />
        </nav>
        <a
          href="https://www.cloudflare.com"
          className="inline-flex shrink-0 items-center gap-0.5 hover:text-fd-foreground"
        >
          {t("footer.hostedCloudflare")}
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </a>
      </div>
    </footer>
  );
}
