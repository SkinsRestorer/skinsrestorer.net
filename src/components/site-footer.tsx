import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t py-6 text-sm text-fd-muted-foreground">
      <div className="mx-auto flex w-full max-w-[var(--fd-layout-width)] flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>&copy; {new Date().getFullYear()} SkinsRestorer</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
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
      </div>
    </footer>
  );
}
