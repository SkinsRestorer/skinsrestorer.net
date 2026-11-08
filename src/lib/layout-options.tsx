import { SiDiscord, SiKofi, SiModrinth } from "@icons-pack/react-simple-icons";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Image } from "@/components/image";

const discordLink = import.meta.env.VITE_DISCORD_LINK;
const modrinthLink = import.meta.env.VITE_MODRINTH_LINK;

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

socialLinks.push({
  type: "icon",
  icon: <SiKofi />,
  text: "Ko-fi",
  url: "https://ko-fi.com/skinsrestorer/tiers",
  external: true,
});

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image
          src={"/logo.png"}
          width={32}
          height={32}
          alt="SkinsRestorer Logo"
          priority
        />
        <span className="font-medium">SkinsRestorer</span>
      </>
    ),
    transparentMode: "top",
  },
  githubUrl: "https://github.com/SkinsRestorer/SkinsRestorer",
  links: socialLinks,
};
