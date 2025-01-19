import {useRouter} from "next/router";

const config: DocsThemeConfig = {
  docsRepositoryBase: "https://github.com/SkinsRestorer/skinsrestorer.net/tree/main",
  head: function useHead() {
    const config = useConfig()
    const {route} = useRouter()
    const image = 'https://skinsrestorer.net/logo.png'

    return (
      <>
        <title>{title}</title>
        <meta property="og:title" content={title}/>
        <meta name="description" content={description}/>
        <meta property="og:description" content={description}/>
        <meta property="og:image" content={image}/>

        <meta name="msapplication-TileColor" content="#B2A711"/>
        <meta name="theme-color" content="#B2A711"/>
        <meta httpEquiv="Content-Language" content="en"/>
        <meta name="twitter:card" content="summary"/>
        <meta name="twitter:site:domain" content="skinsrestorer.net"/>
        <meta name="twitter:url" content="https://skinsrestorer.net"/>

        <link rel="icon" href="/favicon.ico"/>
        <link rel="icon" href="/logo.png" type="image/png"/>
      </>
    )
  },
}

export default config;
