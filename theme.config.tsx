import Image from "next/image";
import {DocsThemeConfig, useConfig} from "nextra-theme-docs";

const themeColor = "#B2A711"
const description = "SkinsRestorer is a Minecraft plugin that allows the modification of in-game player skins."
const config: DocsThemeConfig = {
  docsRepositoryBase: "https://github.com/SkinsRestorer/skinsrestorer.net/tree/main/",
  useNextSeoProps() {
    return {
      titleTemplate: '%s – SR'
    }
  },
  head: function useHead() {
    const {title} = useConfig()

    return (
        <>
          <meta name="msapplication-TileColor" content={themeColor}/>
          <meta name="theme-color" content={themeColor}/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>

          <link rel="icon" href="/favicon.ico"/>

          <meta httpEquiv="Content-Language" content="en"/>

          <meta name="description" content={description}/>

          <meta name="twitter:card" content="summary"/>
          <meta name="twitter:image" content="/logo.png"/>

          <meta property="og:title" content={title}/>
          <meta property="og:description" content={description}/>
          <meta property="og:image" content="/logo.png"/>
        </>
    )
  },
  banner: {
    key: 'v15-release',
    text: (
        <a href="https://github.com/SkinsRestorer/SkinsRestorer/releases" target="_blank" rel="noreferrer">
          🎉 SkinsRestorer v15 is released. Read more →
        </a>
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
    text: 'Edit this page on GitHub →'
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
    text: (
        <div className="flex flex-wrap gap-2">
          <span>
            {new Date().getFullYear()} © <a href="https://skinsrestorer.net" target="_blank">SkinsRestorer</a>
          </span>
          <a href="https://vercel.com/?utm_source=skinsrestorer&utm_campaign=oss">
            <svg width={String(212 / 1.5)} height={String(44 / 1.5)} viewBox="0 0 212 44" fill="none"
                 xmlns="http://www.w3.org/2000/svg">
              <rect width="212" height="44" rx="8" fill="black"/>
              <path
                  d="M60.4375 15.2266V26.5H61.8438V22.4766H64.6797C66.7969 22.4766 68.3047 20.9844 68.3047 18.875C68.3047 16.7266 66.8281 15.2266 64.6953 15.2266H60.4375ZM61.8438 16.4766H64.3281C65.9609 16.4766 66.8594 17.3281 66.8594 18.875C66.8594 20.3672 65.9297 21.2266 64.3281 21.2266H61.8438V16.4766ZM73.3441 26.6484C75.7425 26.6484 77.2269 24.9922 77.2269 22.2891C77.2269 19.5781 75.7425 17.9297 73.3441 17.9297C70.9456 17.9297 69.4613 19.5781 69.4613 22.2891C69.4613 24.9922 70.9456 26.6484 73.3441 26.6484ZM73.3441 25.4375C71.7503 25.4375 70.8519 24.2812 70.8519 22.2891C70.8519 20.2891 71.7503 19.1406 73.3441 19.1406C74.9378 19.1406 75.8363 20.2891 75.8363 22.2891C75.8363 24.2812 74.9378 25.4375 73.3441 25.4375ZM89.2975 18.0781H87.9459L86.2897 24.8125H86.1647L84.2819 18.0781H82.9928L81.11 24.8125H80.985L79.3288 18.0781H77.9694L80.3288 26.5H81.6881L83.5631 19.9844H83.6881L85.5709 26.5H86.9381L89.2975 18.0781ZM93.8213 19.1172C95.1572 19.1172 96.0478 20.1016 96.0791 21.5938H91.4384C91.54 20.1016 92.4775 19.1172 93.8213 19.1172ZM96.04 24.3203C95.6884 25.0625 94.9541 25.4609 93.8681 25.4609C92.4384 25.4609 91.5088 24.4062 91.4384 22.7422V22.6797H97.4931V22.1641C97.4931 19.5469 96.1103 17.9297 93.8369 17.9297C91.5244 17.9297 90.04 19.6484 90.04 22.2969C90.04 24.9609 91.5009 26.6484 93.8369 26.6484C95.6806 26.6484 96.9931 25.7578 97.3838 24.3203H96.04ZM99.2825 26.5H100.626V21.2812C100.626 20.0938 101.556 19.2344 102.837 19.2344C103.103 19.2344 103.587 19.2812 103.697 19.3125V17.9688C103.525 17.9453 103.243 17.9297 103.025 17.9297C101.908 17.9297 100.939 18.5078 100.689 19.3281H100.564V18.0781H99.2825V26.5ZM108.181 19.1172C109.517 19.1172 110.408 20.1016 110.439 21.5938H105.798C105.9 20.1016 106.838 19.1172 108.181 19.1172ZM110.4 24.3203C110.048 25.0625 109.314 25.4609 108.228 25.4609C106.798 25.4609 105.869 24.4062 105.798 22.7422V22.6797H111.853V22.1641C111.853 19.5469 110.47 17.9297 108.197 17.9297C105.884 17.9297 104.4 19.6484 104.4 22.2969C104.4 24.9609 105.861 26.6484 108.197 26.6484C110.041 26.6484 111.353 25.7578 111.744 24.3203H110.4ZM116.76 26.6484C117.924 26.6484 118.924 26.0938 119.455 25.1562H119.58V26.5H120.861V14.7344H119.518V19.4062H119.4C118.924 18.4844 117.932 17.9297 116.76 17.9297C114.619 17.9297 113.221 19.6484 113.221 22.2891C113.221 24.9375 114.603 26.6484 116.76 26.6484ZM117.072 19.1406C118.596 19.1406 119.549 20.3594 119.549 22.2891C119.549 24.2344 118.603 25.4375 117.072 25.4375C115.533 25.4375 114.611 24.2578 114.611 22.2891C114.611 20.3281 115.541 19.1406 117.072 19.1406ZM131.534 26.6484C133.667 26.6484 135.065 24.9219 135.065 22.2891C135.065 19.6406 133.674 17.9297 131.534 17.9297C130.378 17.9297 129.354 18.5 128.893 19.4062H128.768V14.7344H127.424V26.5H128.706V25.1562H128.831C129.362 26.0938 130.362 26.6484 131.534 26.6484ZM131.221 19.1406C132.76 19.1406 133.674 20.3203 133.674 22.2891C133.674 24.2578 132.76 25.4375 131.221 25.4375C129.69 25.4375 128.737 24.2344 128.737 22.2891C128.737 20.3438 129.69 19.1406 131.221 19.1406ZM137.261 29.5469C138.753 29.5469 139.425 28.9688 140.143 27.0156L143.433 18.0781H142.003L139.698 25.0078H139.573L137.261 18.0781H135.808L138.925 26.5078L138.768 27.0078C138.417 28.0234 137.995 28.3906 137.222 28.3906C137.034 28.3906 136.823 28.3828 136.659 28.3516V29.5C136.847 29.5312 137.081 29.5469 137.261 29.5469ZM154.652 26.5L158.55 15.2266H156.402L153.589 24.1484H153.457L150.621 15.2266H148.394L152.332 26.5H154.652ZM162.668 19.3203C163.832 19.3203 164.598 20.1328 164.637 21.3984H160.613C160.699 20.1484 161.512 19.3203 162.668 19.3203ZM164.652 24.1484C164.371 24.7812 163.707 25.1328 162.746 25.1328C161.473 25.1328 160.652 24.2422 160.605 22.8203V22.7188H166.574V22.0938C166.574 19.3984 165.113 17.7812 162.676 17.7812C160.199 17.7812 158.66 19.5078 158.66 22.2578C158.66 25.0078 160.176 26.6719 162.691 26.6719C164.707 26.6719 166.137 25.7031 166.488 24.1484H164.652ZM168.199 26.5H170.137V21.5625C170.137 20.3672 171.012 19.5859 172.27 19.5859C172.598 19.5859 173.113 19.6406 173.262 19.6953V17.8984C173.082 17.8438 172.738 17.8125 172.457 17.8125C171.356 17.8125 170.434 18.4375 170.199 19.2812H170.067V17.9531H168.199V26.5ZM181.7 20.8281C181.497 19.0312 180.168 17.7812 177.973 17.7812C175.403 17.7812 173.895 19.4297 173.895 22.2031C173.895 25.0156 175.411 26.6719 177.981 26.6719C180.145 26.6719 181.489 25.4688 181.7 23.6797H179.856C179.653 24.5703 178.981 25.0469 177.973 25.0469C176.653 25.0469 175.856 24 175.856 22.2031C175.856 20.4297 176.645 19.4062 177.973 19.4062C179.036 19.4062 179.676 20 179.856 20.8281H181.7ZM186.817 19.3203C187.981 19.3203 188.747 20.1328 188.786 21.3984H184.762C184.848 20.1484 185.661 19.3203 186.817 19.3203ZM188.802 24.1484C188.52 24.7812 187.856 25.1328 186.895 25.1328C185.622 25.1328 184.802 24.2422 184.755 22.8203V22.7188H190.723V22.0938C190.723 19.3984 189.262 17.7812 186.825 17.7812C184.348 17.7812 182.809 19.5078 182.809 22.2578C182.809 25.0078 184.325 26.6719 186.841 26.6719C188.856 26.6719 190.286 25.7031 190.637 24.1484H188.802ZM192.427 26.5H194.364V14.6484H192.427V26.5Z"
                  fill="white"/>
              <path d="M23.3248 13L32.6497 29H14L23.3248 13Z" fill="white"/>
              <line x1="43.5" y1="2.18557e-08" x2="43.5" y2="44" stroke="#5E5E5E"/>
            </svg>
          </a>
        </div>
    ),
  }
}

export default config;
