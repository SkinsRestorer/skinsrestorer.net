import Image from "next/image";
import {DocsThemeConfig, useConfig} from "nextra-theme-docs";
import Link from "next/link";
import {useRouter} from "next/router";

const config: DocsThemeConfig = {
  docsRepositoryBase: "https://github.com/SkinsRestorer/skinsrestorer.net/tree/main",
  head: function useHead() {
    const config = useConfig()
    const {route} = useRouter()
    const image = 'https://skinsrestorer.net/logo.png'

    const description =
      config.frontMatter.description ||
      'SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins.'
    const title = config.title + (route === '/' ? '' : ' - SR')

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
  banner: {
    key: 'skinfile-generator',
    content: (
      <Link href="/generator">
        🎉 SkinFile Generator is now part of the main page. Check it out →
      </Link>
    )
  },
  sidebar: {
    toggleButton: true
  },
  logo: <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
    <Image src={"/logo.png"} width={32} height={32} alt="SkinsRestorer Logo"/>
    <span>SkinsRestorer</span>
  </div>,
  project: {
    link: process.env.NEXT_PUBLIC_GITHUB_ORG_LINK,
  },
  editLink: {
    content: 'Edit this page on GitHub →'
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback'
  },
  toc: {
    float: true
  },
  navbar: {
    extraContent: (
      <a href={process.env.NEXT_PUBLIC_SPIGOT_LINK} title="SpigotMC">
        <svg version="1.0" xmlns="http://www.w3.org/2000/svg" height="24"
             viewBox="0 0 1280 1184" fill="currentColor">
          <g transform="translate(0, 1184) scale(0.1, -0.1)" stroke="none">
            <path
              d="M6725 11830 c-98 -20 -291 -117 -362 -183 -24 -22 -53 -57 -64 -77 -25 -45 -47 -56 -134 -70 -107 -17 -556 -31 -785 -25 -351 10 -650 41 -727 75 -24 11 -70 42 -101 70 -96 86 -123 95 -294 95 -128 0 -149 -2 -160 -17 -7 -10 -33 -28 -58 -40 -26 -13 -63 -46 -89 -78 -24 -30 -61 -74 -82 -98 -34 -38 -38 -49 -44 -118 -14 -150 14 -283 84 -391 52 -80 145 -179 200 -211 44 -26 52 -27 182 -27 147 0 145 0 240 76 40 32 91 39 218 29 64 -5 229 -16 366 -25 312 -19 448 -33 500 -53 28 -10 95 -16 228 -20 l189 -4 104 -98 c108 -102 183 -158 221 -165 13 -3 34 -7 48 -10 14 -3 30 -16 34 -28 5 -12 12 -123 16 -247 7 -212 6 -226 -11 -241 -11 -9 -34 -20 -52 -24 -18 -4 -40 -18 -48 -31 -9 -13 -25 -24 -36 -24 -12 0 -63 -20 -115 -45 -116 -55 -193 -128 -246 -233 -45 -90 -54 -155 -33 -220 27 -82 109 -162 165 -162 29 0 48 -34 66 -118 30 -145 12 -193 -80 -206 -25 -3 -94 -28 -153 -55 -59 -27 -121 -52 -138 -56 -17 -3 -42 -18 -55 -32 -13 -14 -92 -86 -176 -159 -84 -74 -174 -160 -200 -191 -26 -31 -81 -94 -122 -140 l-75 -85 -910 7 c-1015 7 -1468 17 -1507 33 -28 11 -52 62 -63 132 -9 54 -61 155 -104 202 -22 24 -49 61 -60 83 -22 43 -134 157 -219 222 -159 124 -648 228 -803 171 -25 -9 -79 -20 -118 -24 -46 -4 -81 -13 -96 -25 -13 -10 -43 -21 -67 -25 -61 -9 -86 -24 -186 -107 -108 -90 -212 -202 -261 -282 -20 -32 -52 -74 -69 -91 -18 -18 -33 -40 -33 -49 0 -9 -13 -28 -29 -43 -16 -15 -31 -42 -35 -62 -3 -19 -36 -82 -72 -140 -76 -120 -194 -353 -194 -382 0 -10 -11 -30 -25 -43 -18 -16 -28 -39 -34 -76 -5 -33 -16 -58 -28 -68 -11 -9 -23 -32 -27 -51 -4 -19 -26 -77 -51 -130 -30 -65 -48 -119 -55 -169 -6 -41 -17 -83 -26 -92 -21 -23 -40 -102 -56 -229 -17 -139 -17 -685 0 -795 34 -212 76 -410 107 -505 19 -58 44 -150 55 -205 11 -55 28 -122 37 -150 53 -164 222 -529 301 -650 54 -83 165 -191 272 -264 50 -34 111 -80 136 -102 73 -63 304 -172 509 -240 93 -30 110 -33 235 -33 94 -1 161 5 220 17 238 51 502 207 582 343 18 32 45 70 61 85 15 15 27 34 27 42 0 26 12 47 26 47 17 0 29 24 38 72 4 20 24 79 46 130 22 52 47 126 57 164 17 66 20 70 65 92 96 48 161 53 808 62 675 9 1109 31 1353 66 l97 14 103 -103 c124 -126 234 -200 452 -307 168 -83 349 -149 475 -174 275 -54 1035 -57 1350 -5 257 43 472 122 578 213 30 25 71 50 95 57 81 22 221 105 327 194 30 26 134 124 230 220 131 129 183 174 208 180 19 4 50 25 75 50 78 80 221 150 355 175 139 25 417 -49 610 -162 79 -46 250 -217 258 -257 4 -18 15 -38 26 -45 23 -16 38 -66 38 -126 0 -28 8 -58 22 -80 14 -24 23 -57 26 -106 6 -98 -7 -120 -107 -173 -96 -52 -176 -122 -236 -206 -59 -83 -84 -140 -91 -214 -5 -44 -13 -68 -30 -87 -34 -36 -33 -114 1 -169 13 -22 25 -52 25 -66 0 -47 68 -164 137 -239 86 -93 150 -135 347 -230 211 -102 351 -150 440 -150 62 0 122 -16 152 -41 9 -7 4 -22 -23 -62 -48 -70 -101 -187 -118 -260 -7 -32 -21 -67 -30 -77 -8 -9 -20 -43 -25 -74 -5 -32 -18 -72 -29 -89 -10 -18 -22 -54 -26 -82 -4 -27 -16 -63 -27 -78 -10 -15 -24 -55 -29 -89 -11 -66 -21 -93 -132 -341 -42 -92 -78 -182 -82 -200 -11 -57 -15 -65 -34 -70 -12 -3 -20 -17 -23 -45 -3 -22 -17 -56 -31 -74 -14 -18 -51 -82 -83 -143 -31 -60 -68 -125 -81 -142 -36 -49 -72 -132 -79 -183 -3 -25 -13 -50 -21 -57 -9 -7 -19 -31 -24 -55 -12 -62 -11 -374 2 -444 12 -68 66 -184 115 -249 19 -24 34 -50 34 -57 0 -8 13 -34 28 -59 53 -83 183 -171 335 -229 56 -21 139 -54 184 -74 45 -20 97 -36 116 -36 57 0 333 39 423 60 46 11 112 31 146 46 35 14 94 37 133 50 38 13 85 35 105 48 19 13 45 26 58 30 12 4 27 17 34 29 6 12 30 39 54 60 57 50 131 149 139 186 3 17 15 33 25 36 55 18 100 337 80 568 -8 93 -16 124 -61 240 -72 182 -116 277 -129 277 -6 0 -20 21 -31 47 -25 58 -113 192 -166 253 -22 25 -43 57 -47 72 -3 15 -15 32 -26 38 -10 6 -26 25 -35 43 -8 17 -44 66 -80 107 -35 41 -79 101 -97 134 -18 33 -45 71 -59 85 -14 15 -29 36 -33 48 -4 12 -27 48 -52 80 -25 31 -47 69 -51 83 -3 14 -19 37 -34 52 -18 16 -29 37 -29 53 0 15 -11 45 -24 68 -27 48 -40 98 -61 242 -21 144 -20 222 4 234 22 12 147 27 301 36 534 31 634 45 875 126 202 68 214 73 316 157 91 73 104 88 124 135 8 20 22 37 30 37 8 0 17 12 21 28 13 58 17 70 60 163 40 88 45 106 51 195 11 189 -40 306 -214 485 l-113 116 0 264 c0 291 12 476 32 511 10 17 13 75 12 223 -1 290 -34 596 -73 673 -10 20 -21 65 -24 100 -5 41 -14 73 -28 92 -13 17 -24 50 -27 80 -3 39 -10 55 -27 66 -13 8 -26 25 -29 37 -3 13 -37 73 -75 135 -39 61 -77 127 -85 146 -8 19 -23 37 -34 40 -11 4 -23 18 -26 31 -13 50 -278 305 -355 341 -20 10 -85 51 -146 92 -178 122 -321 181 -545 226 -123 24 -896 120 -1380 171 -481 51 -729 94 -833 146 -32 16 -65 29 -75 29 -28 0 -118 57 -143 91 -106 141 -552 539 -605 539 -8 0 -19 11 -24 25 -7 19 -17 25 -39 25 -43 0 -149 59 -185 103 -28 35 -29 40 -17 70 7 18 17 55 22 82 7 40 16 57 48 85 77 66 128 238 117 391 -7 102 -16 120 -94 201 -105 110 -284 218 -360 218 -10 0 -28 11 -40 25 -14 16 -32 25 -52 25 -47 0 -53 23 -48 194 5 165 18 219 65 268 15 16 37 28 50 28 13 0 31 9 41 21 31 38 150 119 195 135 37 12 116 14 513 12 l469 -3 83 -72 c56 -48 96 -75 120 -80 59 -13 351 -8 402 6 62 17 130 64 227 155 118 111 126 130 121 315 -3 140 -4 151 -25 171 -15 13 -23 32 -23 54 0 22 -8 40 -26 57 -14 13 -37 45 -50 71 -27 53 -66 88 -100 88 -12 0 -29 7 -38 15 -24 25 -115 63 -192 81 -71 17 -73 17 -132 -5 -91 -34 -204 -104 -275 -170 -35 -33 -74 -62 -88 -66 -14 -3 -73 1 -130 9 -57 9 -219 20 -359 26 -140 6 -289 17 -330 25 -110 22 -195 67 -233 123 -78 113 -228 247 -339 301 -40 20 -90 35 -138 41 -89 11 -358 11 -415 0z"/>
          </g>
        </svg>
      </a>
    )
  },
  chat: {
    link: process.env.NEXT_PUBLIC_DISCORD_LINK,
    icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" height="24" fill="currentColor">
      <title>Discord</title>
      <path
        d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
    </svg>
  },
  footer: {
    content: (
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
    ),
  }
}

export default config;
