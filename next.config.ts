import * as fs from "node:fs";
import * as path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

function getFoldersWithPageFiles(dir: string): string[] {
  const foldersWithPageFiles: string[] = [];

  const items = fs.readdirSync(dir, { withFileTypes: true });

  if (
    items.some(
      (item) =>
        item.isFile() && (item.name === "page.mdx" || item.name === "page.tsx"),
    )
  ) {
    foldersWithPageFiles.push(dir);
  }

  for (const item of items) {
    if (item.isDirectory()) {
      foldersWithPageFiles.push(
        ...getFoldersWithPageFiles(path.join(dir, item.name)),
      );
    }
  }

  return foldersWithPageFiles;
}

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "X-XSS-Protection",
    value: "0",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
];

const baseDir = path.join("src", "app", "(home)");
const config: NextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    viewTransition: true,
  },
  env: {
    SITEMAP_PAGES: getFoldersWithPageFiles(baseDir)
      .map((folder) => folder.substring(baseDir.length))
      .join("|"),
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatars.githubusercontent.com",
        protocol: "https",
      },
      {
        hostname: "github.com",
        protocol: "https",
      },
      {
        hostname: "img.shields.io",
        protocol: "https",
      },
      {
        hostname: "www.netlify.com",
        protocol: "https",
      },
    ],
  },
  redirects: async () => {
    return [
      {
        source: "/discord",
        destination: process.env.NEXT_PUBLIC_DISCORD_LINK ?? "",
        permanent: false,
      },
      {
        source: "/github",
        destination: process.env.NEXT_PUBLIC_GITHUB_LINK ?? "",
        permanent: false,
      },
      {
        source: "/spigot",
        destination: process.env.NEXT_PUBLIC_SPIGOT_LINK ?? "",
        permanent: false,
      },
      {
        source: "/donate",
        destination: process.env.NEXT_PUBLIC_DONATE_LINK ?? "",
        permanent: false,
      },
      {
        source: "/bstats",
        destination: process.env.NEXT_PUBLIC_BSTATS_LINK ?? "",
        permanent: false,
      },
      {
        source: "/modrinth",
        destination: process.env.NEXT_PUBLIC_MODRINTH_LINK ?? "",
        permanent: false,
      },
      {
        source: "/perms",
        destination: "/docs/configuration/commands-permissions",
        permanent: false,
      },
      {
        source: "/skinurl",
        destination: "/upload",
        permanent: false,
      },
      {
        source: "/skinedit",
        destination: "/docs/features/skin-edit",
        permanent: false,
      },
      {
        source: "/unicode",
        destination:
          "https://www.mobilefish.com/services/unicode_escape_sequence_converter/unicode_escape_sequence_converter.php",
        permanent: false,
      },
      {
        source: "/firewall",
        destination: "/docs/troubleshooting/firewall",
        permanent: false,
      },
      {
        source: "/install",
        destination: "/docs/installation",
        permanent: false,
      },
      {
        source: "/contributors",
        destination: `${process.env.NEXT_PUBLIC_GITHUB_LINK ?? ""}/graphs/contributors`,
        permanent: false,
      },
      {
        source: "/docs/troubleshooting/cannot-fetch-new-skins",
        destination: "/docs/troubleshooting/firewall",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/:path*",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*{/}?",
        headers: securityHeaders,
      },
    ];
  },
};

export default withMDX(config);
