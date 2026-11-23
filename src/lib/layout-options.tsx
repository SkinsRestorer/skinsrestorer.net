import { SiDiscord } from "@icons-pack/react-simple-icons";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Image } from "@/components/image";
import type { Locale } from "./i18n";

const discordLink = import.meta.env["VITE_DISCORD_LINK"];

// The header keeps only Discord and GitHub. Downloads and donations have
// their own buttons and the Support page.
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

const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image src="/logo.png" width={32} height={32} alt="" priority />
        <span className="font-medium">SkinsRestorer</span>
      </>
    ),
    transparentMode: "top",
  },
  githubUrl: "https://github.com/SkinsRestorer/SkinsRestorer",
  links: socialLinks,
};

export function getBaseOptions(locale: Locale): BaseLayoutProps {
  return {
    ...baseOptions,
    // oxlint-disable-next-line typescript/no-deprecated -- keeps the language switch; the slot-based replacement is not equivalent
    i18n: true,
    nav: { ...baseOptions.nav, url: locale === "en" ? "/" : `/${locale}` },
  };
}
