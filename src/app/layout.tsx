import "@/style.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { Toaster } from "@/components/ui/sonner";
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
    locale: "en_US",
    type: "website",
    images: "/logo.png",
  },
  alternates: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    canonical: "./",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="aer4SuKmVEAedLgr3jfsYA"
          async
        ></script>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5188410388521363"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          "flex size-full min-h-svh flex-col antialiased",
        )}
        suppressHydrationWarning
      >
        <RootProvider>
          {/*
          <Banner id={"upload-now-website"}>
            🎉 You can now upload skin .png files here!
          </Banner>
          */}
          {children}
          <Toaster richColors />
          <CookieConsentBanner />
        </RootProvider>
      </body>
    </html>
  );
}
