import Image from "next/image";
import Link from "next/link";
import { PrivacySettingsLink } from "@/components/privacy-settings-link";

export async function SiteFooter() {
  "use cache";

  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t py-6 text-sm text-fd-muted-foreground">
      <div className="mx-auto flex w-full max-w-[var(--fd-layout-width)] flex-col items-center gap-3 px-4 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left">
        <p>&copy; {year} SkinsRestorer</p>
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
          <PrivacySettingsLink />
        </nav>
        <a href="https://www.netlify.com" className="shrink-0">
          <Image
            src="https://www.netlify.com/assets/badges/netlify-badge-color-accent.svg"
            alt="Deploys by Netlify"
            width={114}
            height={32}
            className="h-8 w-auto"
            unoptimized
          />
        </a>
      </div>
    </footer>
  );
}
