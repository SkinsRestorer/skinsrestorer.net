import * as fs from "node:fs";
import * as path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { withPlausibleProxy } from "next-plausible";

const withMDX = createMDX();

function getFoldersWithPageFiles(dir: string): string[] {
  const foldersWithPageFiles: string[] = [];

  // Read the contents of the current directory.
  const items = fs.readdirSync(dir);

  // Check if the current directory contains either 'page.mdx' or 'page.tsx'
  const containsPageFile = items.some(
    (item) => item === "page.mdx" || item === "page.tsx",
  );

  if (containsPageFile) {
    foldersWithPageFiles.push(dir);
  }

  // Loop through each item in the directory.
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    // If the item is a directory, recursively search it.
    if (stat.isDirectory()) {
      foldersWithPageFiles.push(...getFoldersWithPageFiles(fullPath));
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
    value: "1; mode=block",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; connect-src 'self' https://discord.com https://api.mineskin.org; font-src 'self'; frame-src 'self' https://www.youtube.com; img-src 'self' data: blob: https://avatars.githubusercontent.com https://img.shields.io; manifest-src 'self'; media-src 'self' https://github.com https://github-production-user-asset-6210df.s3.amazonaws.com; worker-src 'self';",
  },
];

const baseDir = path.join("src", "app", "(home)");
const config: NextConfig = {
  reactStrictMode: true,
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
        destination: "/docs/troubleshooting",
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
        source: "/va/:match*",
        destination: "/_vercel/insights/:match*",
      },
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

export default withMDX(
  withPlausibleProxy({
    customDomain: process.env.PLAUSIBLE_URL,
  })(config),
);
