
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Callout } from 'fumadocs-ui/components/callout';
import Image from 'next/image';
import { GitBranchIcon } from 'lucide-react';
import { Page } from '@/components/page';

export default function DownloadPage() {
  return (
    <Page
      title="Download"
      description="Download SkinsRestorer for your Minecraft server."
    >
      <div className="flex flex-col gap-8">
        <div className="prose">
          <p>
            SkinsRestorer is available for various platforms. Select your server
            type below to download the latest version.
          </p>
        </div>
        <Cards>
          <Card
            icon={
              <Image
                src="/platform/bukkit.png"
                alt="Bukkit/Spigot/Paper"
                width={24}
                height={24}
              />
            }
            title="Bukkit/Spigot/Paper"
            href="https://modrinth.com/plugin/skinsrestorer/versions"
          ></Card>
          <Card
            icon={
              <Image
                src="/platform/bungeecord.png"
                alt="BungeeCord"
                width={24}
                height={24}
              />
            }
            title="BungeeCord"
            href="https://modrinth.com/plugin/skinsrestorer/versions"
          ></Card>
          <Card
            icon={
              <svg
                viewBox="0 0 34 34"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g>
                  <path
                    fill="#1BBAE0"
                    d="m15.949 15.137-4.22-5.758a.925.925 0 0 0-.93-.36l-6.731 1.36a.927.927 0 0 0-.625.458L.116 16.852a.924.924 0 0 0 .063.994l4.23 5.775a.926.926 0 0 0 .93.36l6.711-1.355a.925.925 0 0 0 .624-.46l3.339-6.032a.926.926 0 0 0-.064-.997Zm-4.64 5.791a.746.746 0 0 1-1.044-.16l-2.42-3.297a1.248 1.248 0 0 0-1.248-.484l-4.103.83a.748.748 0 0 1-.3-1.466l4.449-.9a1.249 1.249 0 0 0 .844-.617l2.232-4.032a.748.748 0 0 1 1.37.154.747.747 0 0 1-.063.568L8.97 15.25a1.249 1.249 0 0 0 .085 1.34l2.42 3.295a.748.748 0 0 1-.164 1.043Z"
                  ></path>
                  <path
                    fill="#00A6CD"
                    d="M33.276 17.716H19.403a.767.767 0 0 1 0-1.534h8.29a.768.768 0 0 0 0-1.535h-5.479a.767.767 0 1 1 0-1.534h8.3a.768.768 0 0 0 0-1.535H13.34l2.608 3.56a.925.925 0 0 1 .064.994l-3.339 6.032a.919.919 0 0 1-.109.156H29.13a.767.767 0 1 0 0-1.534h-4.177a.768.768 0 1 1 0-1.535h8.323a.769.769 0 1 0 0-1.535ZM30.01 16.182a.767.767 0 1 0 0-1.534.767.767 0 0 0 0 1.534Z"
                  ></path>
                </g>
              </svg>
            }
            title="Velocity"
            href="https://modrinth.com/plugin/skinsrestorer/versions"
          ></Card>
          <Card
            icon={
              <Image
                src="/platform/fabric.svg"
                alt="Fabric"
                width={24}
                height={24}
              />
            }
            title="Fabric"
            href="https://modrinth.com/plugin/skinsrestorer/versions"
          ></Card>
          <Card
            icon={
              <Image
                src="/platform/neoforge.svg"
                alt="NeoForge"
                width={24}
                height={24}
              />
            }
            title="NeoForge"
            href="https://modrinth.com/plugin/skinsrestorer/versions"
          ></Card>
        </Cards>
        <Callout type="warning" emoji="🆕">
          The Fabric and NeoForge mod releases of SkinsRestorer currently
          support **only the latest Minecraft version**. They provide the same
          features as the Bukkit plugin when used on that supported release.
        </Callout>

        <div className="prose">
          <p>
            For more information on how to install SkinsRestorer, please refer
            to the{' '}
            <a href="/docs/installation">installation documentation</a>.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <a
            href="https://github.com/SkinsRestorer/SkinsRestorer/releases"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <GitBranchIcon className="h-4 w-4" />
            Looking for a specific version? Find it on GitHub Releases.
          </a>
        </div>
      </div>
    </Page>
  );
}
