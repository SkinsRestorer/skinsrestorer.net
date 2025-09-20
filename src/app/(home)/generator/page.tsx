import {GenerateFileCard, OnlineCard, ReverseFileCard} from "./generator-card";
import {Metadata} from "next";

export const metadata: Metadata = {
  description: "Generate or reverse skin files to use with SkinsRestorer.",
  openGraph: {
    images: "https://skinsrestorer.net/og?title=Generator"
  }
}

export default function RootComponent() {
  return (
    <article
      className="w-full overflow-x-hidden break-words nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)]">
      <main className="w-full min-w-0 max-w-6xl px-6 pt-4 md:px-12">
        <div className="mt-8 md:mt-16 mx-auto container">
          <h1 className="text-4xl font-bold text-center">Skin file generator</h1>
          <p className="text-center mt-4">Generate or reverse skin files to use with SkinsRestorer.</p>
          <div className="flex flex-col md:flex-row md:justify-center mt-8 gap-4">
            <OnlineCard/>
            <GenerateFileCard/>
            <ReverseFileCard/>
          </div>
        </div>
      </main>
    </article>
  )
}
