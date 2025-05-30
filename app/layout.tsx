import {Footer, Layout, Navbar} from 'nextra-theme-docs'
import {Banner, Head} from 'nextra/components'
import {getPageMap} from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import '~/style.css'
import PlausibleProvider from "next-plausible";
import {Toaster} from "~/components/ui/sonner";
import Link from "next/link";
import Image from "next/image";
import {Metadata, Viewport} from "next";
import {SiDiscord, SiModrinth} from "@icons-pack/react-simple-icons";

export const metadata: Metadata = {
  metadataBase: new URL('https://skinsrestorer.net'),
  title: {
    default: 'SkinsRestorer - Minecraft Skin Plugin',
    template: '%s - SR'
  },
  description: 'SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins.',
  applicationName: 'SkinsRestorer',
  generator: 'Next.js',
  appleWebApp: {
    title: 'SkinsRestorer'
  },
  other: {
    'msapplication-TileColor': "#B2A711"
  },
  twitter: {
    site: 'https://skinsrestorer.net',
    card: "summary_large_image"
  },
  openGraph: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    url: './',
    siteName: 'SkinsRestorer',
    locale: 'en_US',
    type: 'website'
  },
  alternates: {
    // https://github.com/vercel/next.js/discussions/50189#discussioncomment-10826632
    canonical: './'
  }
}

export const viewport: Viewport = {
  themeColor: "#B2A711"
}

export default async function RootLayout({children}) {
  const navbar = (
    <Navbar
      logo={
        <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
          <Image src={"/logo.png"} width={32} height={32} alt="SkinsRestorer Logo"/>
          <span>SkinsRestorer</span>
        </div>
      }
      chatLink={process.env.NEXT_PUBLIC_DISCORD_LINK}
      chatIcon={
        <SiDiscord/>
      }
      projectLink={process.env.NEXT_PUBLIC_GITHUB_ORG_LINK}
    >
      <a href={process.env.NEXT_PUBLIC_MODRINTH_LINK} title="Modrinth">
        <SiModrinth/>
      </a>
    </Navbar>
  )
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
    <Head faviconGlyph="✦">
      <PlausibleProvider trackOutboundLinks trackFileDownloads scriptProps={{"add-file-types": "jar"} as never}
                         domain="skinsrestorer.net"/>
    </Head>
    <body suppressHydrationWarning>
    <Layout
      toc={{
        float: true
      }}
      feedback={{
        content: 'Question? Give us feedback →',
        labels: 'feedback'
      }}
      banner={
        <Banner storageKey="skinfile-generator">
          <Link href="/generator">
            🎉 SkinFile Generator is now part of the main page. Check it out →
          </Link>
        </Banner>
      }
      navbar={navbar}
      footer={<Footer>
        <div className="flex w-full flex-col items-center sm:items-start">
          <div>
            <a
              className="flex items-center gap-1 text-current"
              target="_blank"
              rel="noopener noreferrer"
              title="vercel.com homepage"
              href="https://vercel.com/?utm_source=skinsrestorer&utm_campaign=oss"
            >
              <span>Powered by</span>
              <svg height={20} viewBox="0 0 283 64" fill="none">
                <title>Vercel</title>
                <path
                  fill="currentColor"
                  d="M141.04 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.46 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM248.72 16c-11.04 0-19 7.2-19 18s8.96 18 20 18c6.67 0 12.55-2.64 16.19-7.09l-7.65-4.42c-2.02 2.21-5.09 3.5-8.54 3.5-4.79 0-8.86-2.5-10.37-6.5h28.02c.22-1.12.35-2.28.35-3.5 0-10.79-7.96-17.99-19-17.99zm-9.45 14.5c1.25-3.99 4.67-6.5 9.45-6.5 4.79 0 8.21 2.51 9.45 6.5h-18.9zM200.24 34c0 6 3.92 10 10 10 4.12 0 7.21-1.87 8.8-4.92l7.68 4.43c-3.18 5.3-9.14 8.49-16.48 8.49-11.05 0-19-7.2-19-18s7.96-18 19-18c7.34 0 13.29 3.19 16.48 8.49l-7.68 4.43c-1.59-3.05-4.68-4.92-8.8-4.92-6.07 0-10 4-10 10zm82.48-29v46h-9V5h9zM36.95 0L73.9 64H0L36.95 0zm92.38 5l-27.71 48L73.91 5H84.3l17.32 30 17.32-30h10.39zm58.91 12v9.69c-1-.29-2.06-.49-3.2-.49-5.81 0-10 4-10 10V51h-9V17h9v9.2c0-5.08 5.91-9.2 13.2-9.2z"
                />
              </svg>
            </a>
          </div>
          <p className="mt-6 text-xs">
            © {new Date().getFullYear()} SkinsRestorer
          </p>
        </div>
      </Footer>}
      editLink="Edit this page on GitHub →"
      docsRepositoryBase="https://github.com/SkinsRestorer/skinsrestorer.net/blob/main"
      sidebar={{toggleButton: true}}
      pageMap={await getPageMap()}
    >
      {children}
      <Toaster richColors/>
    </Layout>
    </body>
    </html>
  )
}
