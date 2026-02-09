import { SiDiscord, SiModrinth } from "@icons-pack/react-simple-icons";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { i18n } from "@/lib/i18n";

const discordLink = process.env.NEXT_PUBLIC_DISCORD_LINK;
const modrinthLink = process.env.NEXT_PUBLIC_MODRINTH_LINK;

const socialLinks: BaseLayoutProps["links"] = [];

if (discordLink) {
  socialLinks.push({
    type: "icon",
    icon: <SiDiscord />,
    text: "Discord",
    url: discordLink,
    external: true,
  });
}

if (modrinthLink) {
  socialLinks.push({
    type: "icon",
    icon: <SiModrinth />,
    text: "Modrinth",
    url: modrinthLink,
    external: true,
  });
}

export function baseOptions(locale: string): BaseLayoutProps {
  return {
    i18n,
    nav: {
      title: (
        <>
          <Image
            src={"/logo.png"}
            width={32}
            height={32}
            alt="SkinsRestorer Logo"
          />
          <span className="font-medium">SkinsRestorer</span>
        </>
      ),
      transparentMode: "top",
    },
    githubUrl: "https://github.com/SkinsRestorer/SkinsRestorer",
    links: socialLinks,
  };
}
