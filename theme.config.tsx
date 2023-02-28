import Image from "next/image";
import {DocsThemeConfig, useConfig} from "nextra-theme-docs";
import {useRouter} from "next/router";

const description = "SkinsRestorer is a Minecraft plugin that allows the modification of ingame skins. That also allows the restoring of skins on offline mode servers."
const config: DocsThemeConfig = {
  docsRepositoryBase: "https://github.com/SkinsRestorer/skinsrestorer.net",
  useNextSeoProps() {
    const {pathname} = useRouter()
    if (pathname !== '/') {
      return {
        titleTemplate: '%s – SR'
      }
    }
  },
  head: function useHead() {
    const { title } = useConfig()
    const { route } = useRouter()

    return (
        <>
          <meta name="msapplication-TileColor" content="#fff"/>
          <meta name="theme-color" content="#fff"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

          <link rel="icon" href="/favicon.ico"/>

          <meta httpEquiv="Content-Language" content="en"/>

          <meta
              name="og:title"
              content={title ? title + ' – SR' : 'SkinsRestorer'}
          />

          <meta name="description" content={description}/>
          <meta property="og:description" content={description}/>

          <meta name="twitter:card" content="summary"/>
        </>
    )
  },
  // banner: {
  //  key: 'v15-release',
  //  text: (
  //      <a href="https://github.com/SkinsRestorer/SkinsRestorerX" target="_blank" rel="noreferrer">
  //        🎉 SkinsRestorer v15 is released. Read more →
  //      </a>
  //  )
  // },
  sidebar: {
    toggleButton: true
  },
  logo: <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
    <Image src={"/logo.png"} width={32} height={32} alt="SkinsRestorer Logo"/>
    <span>SkinsRestorer</span>
  </div>,
  project: {
    link: 'https://github.com/SkinsRestorer/SkinsRestorerX',
  },
  editLink: {
    text: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  chat: {
    link: process.env.NEXT_PUBLIC_DISCORD_LINK,
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" height="24" fill="currentColor">
      <path
          d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  },
  footer: {
    text: <span>{new Date().getFullYear()} © <a href="https://skinsrestorer.net"
                                                target="_blank">SkinsRestorer</a>.</span>,
  }
}

export default config;
