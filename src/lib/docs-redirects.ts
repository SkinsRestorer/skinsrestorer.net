/** Canonical replacements for retired documentation pages. */
export const docsRedirects = [
  {
    source: "/docs/features/skin-url",
    destination: "/docs/features/skin-upload",
  },
  {
    source: "/docs/troubleshooting/cannot-fetch-new-skins",
    destination: "/docs/troubleshooting/firewall",
  },
  {
    source: "/docs/configuration/commands-permissions",
    destination: "/docs/reference/commands-permissions",
  },
  {
    source: "/docs/configuration/options",
    destination: "/docs/reference",
  },
  {
    source: "/docs/features/custom-skins",
    destination: "/docs/configuration/custom-skins",
  },
  {
    source: "/docs/development/inner-workings",
    destination: "/docs/concepts/skin-lifecycle",
  },
  {
    source: "/docs/reference/documentation",
    destination: "/docs",
  },
] as const;
