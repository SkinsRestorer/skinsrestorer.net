import { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { SiDiscord, SiModrinth } from '@icons-pack/react-simple-icons';

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image src={'/logo.png'} width={32} height={32} alt="SkinsRestorer Logo" />
        <span className="font-medium">SkinsRestorer</span>
      </>
    ),
    transparentMode: 'top',
  },
  githubUrl: 'https://github.com/SkinsRestorer/SkinsRestorer',
  links: [
    {
      type: "icon",
      icon: <SiDiscord/>,
      text: "Discord",
      url: process.env.NEXT_PUBLIC_DISCORD_LINK!,
      external: true,
    },
    {
      type: "icon",
      icon: <SiModrinth/>,
      text: "Modrinth",
      url: process.env.NEXT_PUBLIC_MODRINTH_LINK!,
      external: true,
    }
  ]
};
