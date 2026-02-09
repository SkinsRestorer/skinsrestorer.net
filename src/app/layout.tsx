import "@/style.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL("https://skinsrestorer.net"),
  title: {
    default: "SkinsRestorer - Minecraft Skin Plugin",
    template: "%s - SR",
  },
  description:
    "SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins.",
  applicationName: "SkinsRestorer",
  generator: "Next.js",
  appleWebApp: {
    title: "SkinsRestorer",
  },
  other: {
    "msapplication-TileColor": "#B2A711",
  },
  twitter: {
    site: "https://skinsrestorer.net",
    card: "summary",
    images: "/logo.png",
  },
  openGraph: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    url: "./",
    siteName: "SkinsRestorer",
    type: "website",
    images: "/logo.png",
  },
  alternates: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    canonical: "./",
    languages: {
      en: "/",
      de: "/de",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#B2A711",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          "flex size-full min-h-svh flex-col antialiased",
        )}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
