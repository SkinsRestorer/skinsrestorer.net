import {
  GenerateFileCard,
  OnlineCard,
  ReverseFileCard,
} from './generator-card';
import { Metadata } from 'next';

export const metadata: Metadata = {
  description: 'Generate or reverse skin files to use with SkinsRestorer.',
  openGraph: {
    images: 'https://skinsrestorer.net/og?title=Generator',
  },
};

export default function RootComponent() {
  return (
    <article className="w-full overflow-x-hidden break-words nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)]">
      <main className="w-full min-w-0 max-w-6xl px-6 pt-8 md:px-12">
        <div className="mx-auto container">
          <div className="text-center py-12 md:py-20">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-4">
              Skin File Generator
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Generate or reverse skin files to use with SkinsRestorer
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <OnlineCard />
            <GenerateFileCard />
            <ReverseFileCard />
          </div>
        </div>
      </main>
    </article>
  );
}
