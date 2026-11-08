import Link from "fumadocs-core/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t py-6 text-sm text-fd-muted-foreground">
      <div className="mx-auto flex w-full max-w-[var(--fd-layout-width)] flex-col items-center gap-3 px-4 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
        <p>&copy; {year} SkinsRestorer</p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          <Link href="/donate" className="hover:text-fd-foreground">
            Support SkinsRestorer
          </Link>
          <Link href="/terms-of-service" className="hover:text-fd-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy-policy" className="hover:text-fd-foreground">
            Privacy Policy
          </Link>
          <Link href="/cookie-policy" className="hover:text-fd-foreground">
            Cookie Policy
          </Link>
        </nav>
        <a
          href="https://www.cloudflare.com"
          className="shrink-0 hover:text-fd-foreground"
        >
          Hosted on Cloudflare
        </a>
      </div>
    </footer>
  );
}
