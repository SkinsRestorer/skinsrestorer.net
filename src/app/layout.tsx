import "@/style.css";
import { Banner } from "fumadocs-ui/components/banner";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
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
    card: "summary_large_image",
  },
  openGraph: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    url: "./",
    siteName: "SkinsRestorer",
    locale: "en_US",
    type: "website",
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
      <body
        className={cn(
          GeistSans.variable,
          GeistMono.variable,
          "flex size-full min-h-svh flex-col antialiased",
        )}
        suppressHydrationWarning
      >
        <RootProvider>
          <Banner id={"upload-now-website"}>
            🎉 You can now upload skin .png files here!
          </Banner>
          {children}
          <Toaster richColors />
        </RootProvider>
      </body>
    </html>
  );
}
