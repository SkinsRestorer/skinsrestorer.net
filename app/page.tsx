import Link from "next/link";
import {ArrowDownTrayIcon, ChevronDoubleRightIcon} from "@heroicons/react/20/solid";
import {BoltIcon, CloudArrowDownIcon, PhotoIcon, RocketLaunchIcon, Squares2X2Icon} from "@heroicons/react/24/solid";
import Image from "next/image";
import {CustomTimeAgo} from "~/components/time-ago";

export const metadata = {}

const getReleaseData = async () => {
  const res = await fetch(`https://api.github.com/repos/SkinsRestorer/SkinsRestorer/releases/latest`);
  const release = await res.json();
  return ({
    latest: {
      url: release["html_url"],
      name: release["name"],
      tag: release["tag_name"],
      download: release.assets[0]["browser_download_url"],
      author: {
        name: release.author["login"],
        url: release.author["html_url"],
        avatar: release.author["avatar_url"]
      },
      time: release["published_at"]
    }
  });
}

const LatestRelease = async () => {
  const {latest} = await getReleaseData()
  return (
    <div
      className="nextra-card mt-4 p-4 group flex flex-wrap gap-2 justify-between overflow-hidden rounded-lg border border-gray-200 text-current dark:shadow-none hover:shadow-gray-100 dark:hover:shadow-none shadow-gray-100 active:shadow-xs active:shadow-gray-200 transition-all duration-200 hover:border-gray-300 bg-transparent shadow-xs dark:border-neutral-800">
      <div className="flex flex-col">
        <div className="flex flex-wrap gap-1">
          <a
            href={latest.url}
            className="flex font-semibold text-lg items-start text-gray-700 hover:text-gray-900 dark:text-neutral-200 dark:hover:text-neutral-50">{latest.name}</a>
          <div className="flex flex-row gap-1">
            <div>
                            <span
                              className="rounded-full border w-fit px-1 text-xs border-green-400 text-green-400 justify-center">Latest Release</span>
            </div>
            <div>
                            <span
                              className="rounded-full border w-fit px-1 text-xs border-gray-400 text-gray-400 justify-center">{latest.tag}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-row mt-1">
          <span className="flex flex-row cursor-pointer">Released by </span>
          <a
            href={latest.author.url}
            className="flex items-start text-gray-700 hover:text-gray-900 dark:text-neutral-200 dark:hover:text-neutral-50">
            <Image className="rounded-full w-6 h-6 my-auto mx-1" src={latest.author.avatar}
                   width={16} height={16} alt={latest.author.name}/>
            <span className="font-semibold">{latest.author.name}</span>
            <span className="mx-1"><CustomTimeAgo date={latest.time}/></span>
          </a>
        </div>
      </div>
      <div className="flex flex-col justify-center">
        <a
          href={latest.download}
          className="nextra-card front-button p-2 group">
          <ArrowDownTrayIcon className="w-6 h-6 fill-gray-500 dark:fill-neutral-400"/>
          <span>Download</span>
        </a>
      </div>
    </div>
  )
}

const FeatureCard = ({title, description, icon}) => {
  return (
    <div
      className="nextra-card feature-card group">
      <div className="flex flex-col">
        {icon}
        <h2 className="text-center text-xl font-semibold">{title}</h2>
        <p className="text-center">{description}</p>
      </div>
    </div>
  )
}

const TeamCard = ({githubUsername, description}) => {
  return (
    <a href={`https://github.com/${githubUsername}`}>
      <div className="nextra-card feature-card group flex-col md:flex-row gap-4">
        <Image src={`https://github.com/${githubUsername}.png`} width={64} height={64} className="rounded-lg"
               alt={githubUsername}/>
        <div className="flex flex-col">
          <p className="font-semibold text-lg">{githubUsername}</p>
          <p>{description}</p>
        </div>
      </div>
    </a>
  )
}

export default function IndexPage() {
  return (
    <article
      className="w-full overflow-x-hidden break-words nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)]">
      <main className="w-full min-w-0 max-w-6xl px-6 pt-4 md:px-12">
        <div className="mx-auto container">
          <LatestRelease/>
          <div className="p-4 flex flex-col">
            <div className="mt-8 md:mt-16 flex flex-col md:flex-row mx-auto gap-2">
              <Image src="/logo.png" width={128} height={128}
                     className="w-24 md:w-16 h-24 md:h-16 mx-auto"
                     alt="SkinsRestorer Logo"/>
              <h1 className="my-auto text-center text-5xl font-bold">
                SkinsRestorer
              </h1>
            </div>
            <p className="text-center mt-2 text-lg">The most popular skin plugin for Minecraft</p>
            <Link href="/docs/installation"
                  className="nextra-card front-button mt-6 p-2 group">
              <span>Get Started</span>
              <ChevronDoubleRightIcon className="w-6 h-6 m-auto fill-gray-500 dark:fill-neutral-400"/>
            </Link>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8 md:mt-16">
              <Link
                href="/docs/installation"
              >
                <FeatureCard
                  title="Easy to use"
                  description="SkinsRestorer is easy to use, just install it and you're ready to go!"
                  icon={<RocketLaunchIcon className="w-6 h-6 mx-auto my-2"/>}
                />
              </Link>
              <FeatureCard
                title="Change your skin"
                description={<span>Just run <code className="highlight-code">/skin &lt;name&gt;</code> to change your skin! It's that easy!</span>}
                icon={<BoltIcon className="w-6 h-6 mx-auto my-2"/>}
              />
              <FeatureCard
                title="Restore your skins"
                description="SkinsRestorer can restore your skins on offline mode servers!"
                icon={<CloudArrowDownIcon
                  className="w-6 h-6 mx-auto my-2"/>}
              />
              <a href={process.env.NEXT_PUBLIC_GITHUB_LINK}>
                <FeatureCard
                  title="Open Source"
                  description="SkinsRestorer is open source, you can contribute to it on GitHub!"
                  icon={<svg xmlns="http://www.w3.org/2000/svg" height="32.666666666666664" width="32"
                             viewBox="0 0 98 96" className="w-6 h-6 mx-auto my-2">
                    <path fillRule="evenodd" clipRule="evenodd"
                          d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                          fill="currentColor"></path>
                  </svg>}
                />
              </a>
              <FeatureCard
                title="Use your own skin"
                description={<span>Use <code className="highlight-code">/skin url "&lt;url&gt;"</code> to use a skin from the internet!</span>}
                icon={<PhotoIcon className="w-6 h-6 mx-auto my-2"/>}
              />
              <FeatureCard
                title="Use our GUI"
                description={<span>SkinsRestorer has a GUI to change your skin, just run <code
                  className="highlight-code">/skins</code>!</span>}
                icon={<Squares2X2Icon className="w-6 h-6 mx-auto my-2"/>}
              />
            </div>
            <h2 className="text-center text-3xl font-bold mt-8 md:mt-16">
              Meet the team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 md:mt-16 items-center w-fit mx-auto">
              <TeamCard githubUsername="xknat" description="Developer"/>
              <TeamCard githubUsername="AlexProgrammerDE" description="Developer"/>
              <TeamCard githubUsername="aljaxus" description="System Administrator"/>
            </div>
          </div>
        </div>
      </main>
    </article>
  )
}
