import Link from 'next/link';
import {
  Download,
  ChevronsRight,
  Zap,
  CloudDownload,
  Image as ImageIcon,
  Rocket,
  Grid3X3,
} from 'lucide-react';
import Image from 'next/image';
import { CustomTimeAgo } from '~/components/time-ago';
import { Metadata } from 'next';
import { SiGithub } from '@icons-pack/react-simple-icons';
import { paths } from '@octokit/openapi-types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Button } from '~/components/ui/button';

type LatestReleaseResponse =
  paths['/repos/{owner}/{repo}/releases/latest']['get']['responses']['200']['content']['application/json'];

export const revalidate = 120; // 2 minutes

export const metadata: Metadata = {
  openGraph: {
    images: 'https://skinsrestorer.net/og?title=SkinsRestorer',
  },
};

async function getReleaseData(): Promise<LatestReleaseResponse> {
  const response = await fetch(
    'https://api.github.com/repos/SkinsRestorer/SkinsRestorer/releases/latest',
    {
      next: {
        revalidate: 120,
      },
    },
  );
  return await response.json();
}

async function LatestRelease() {
  const data: LatestReleaseResponse = await getReleaseData();
  const releaseLink = `https://modrinth.com/plugin/skinsrestorer/version/${data.tag_name}`;
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">
            <a
              href={releaseLink}
              className="hover:text-primary transition-colors"
            >
              {data.name}
            </a>
          </CardTitle>
          <span className="inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-700">
            Latest Release
          </span>
        </div>
        <CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <span>Released by</span>
            <div className="flex items-center gap-2">
              <Image
                className="rounded-full w-6 h-6"
                src={data.author.avatar_url}
                width={24}
                height={24}
                alt={data.author.login}
              />
              <span className="font-medium">{data.author.login}</span>
            </div>
            <CustomTimeAgo date={data.published_at || new Date()} />
          </div>
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <a href={releaseLink}>
            <Download className="w-4 h-4" />
            Download
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

const FeatureCard = ({
  title,
  description,
  icon,
}: {
  title: string;
  description: string | React.ReactNode;
  icon: React.ReactNode;
}) => {
  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardContent className="flex flex-col items-center text-center p-6">
        <div className="mb-4 text-muted-foreground group-hover:text-primary transition-colors">
          {icon}
        </div>
        <CardTitle className="text-xl mb-2">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

const TeamCard = ({
  githubUsername,
  description,
}: {
  githubUsername: string;
  description: string;
}) => {
  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        <a
          href={`https://github.com/${githubUsername}`}
          className="flex flex-col sm:flex-row items-center gap-4 hover:opacity-80 transition-opacity"
        >
          <Image
            src={`https://github.com/${githubUsername}.png`}
            width={64}
            height={64}
            className="rounded-lg"
            alt={githubUsername}
          />
          <div className="flex flex-col text-center sm:text-left">
            <CardTitle className="text-lg">{githubUsername}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </a>
      </CardContent>
    </Card>
  );
};

export default function IndexPage() {
  return (
    <article className="w-full overflow-x-hidden break-words nextra-content flex min-h-[calc(100vh-var(--nextra-navbar-height))] min-w-0 justify-center pb-8 pr-[calc(env(safe-area-inset-right)-1.5rem)]">
      <main className="w-full min-w-0 max-w-6xl px-6 pt-8 md:px-12">
        <div className="mx-auto container">
          <LatestRelease />
          <div className="py-12 md:py-20 flex flex-col items-center text-center">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6">
              <Image
                src="/logo.png"
                width={128}
                height={128}
                className="w-20 md:w-24 h-20 md:h-24"
                alt="SkinsRestorer Logo"
              />
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                SkinsRestorer
              </h1>
            </div>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-8">
              The most popular skin plugin for Minecraft
            </p>
            <Button asChild size="lg" className="text-base px-8 py-3">
              <Link href="/docs/installation">
                Get Started
                <ChevronsRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16 md:mt-24">
              <Link href="/docs/installation">
                <FeatureCard
                  title="Easy to use"
                  description="SkinsRestorer is easy to use, just install it and you're ready to go!"
                  icon={<Rocket className="w-6 h-6 mx-auto my-2" />}
                />
              </Link>
              <FeatureCard
                title="Change your skin"
                description={
                  <span>
                    Just run{' '}
                    <code className="highlight-code">/skin &lt;name&gt;</code>{' '}
                    to change your skin! It's that easy!
                  </span>
                }
                icon={<Zap className="w-6 h-6 mx-auto my-2" />}
              />
              <FeatureCard
                title="Restore your skins"
                description="SkinsRestorer can restore your skins on offline mode servers!"
                icon={<CloudDownload className="w-6 h-6 mx-auto my-2" />}
              />
              <a href={process.env.NEXT_PUBLIC_GITHUB_LINK}>
                <FeatureCard
                  title="Open Source"
                  description="SkinsRestorer is open source, you can contribute to it on GitHub!"
                  icon={<SiGithub className="w-6 h-6 mx-auto my-2" />}
                />
              </a>
              <FeatureCard
                title="Use your own skin"
                description={
                  <span>
                    Use{' '}
                    <code className="highlight-code">
                      /skin url "&lt;url&gt;"
                    </code>{' '}
                    to use a skin from the internet!
                  </span>
                }
                icon={<ImageIcon className="w-6 h-6 mx-auto my-2" />}
              />
              <FeatureCard
                title="Use our GUI"
                description={
                  <span>
                    SkinsRestorer has a GUI to change your skin, just run{' '}
                    <code className="highlight-code">/skins</code>!
                  </span>
                }
                icon={<Grid3X3 className="w-6 h-6 mx-auto my-2" />}
              />
            </div>
            <h2 className="text-center text-3xl md:text-4xl font-bold mt-20 md:mt-32 mb-12">
              Meet the team
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <TeamCard githubUsername="xknat" description="Developer" />
              <TeamCard
                githubUsername="AlexProgrammerDE"
                description="Developer"
              />
              <TeamCard
                githubUsername="aljaxus"
                description="System Administrator"
              />
            </div>
          </div>
        </div>
      </main>
    </article>
  );
}
