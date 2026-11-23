import assert from "node:assert/strict";
import { test } from "node:test";

// Pin the configured links so the tests do not depend on the checked-in .env.
// The module reads them once, when it loads.
const pinned = {
  VITE_GITHUB_LINK: "https://github.com/example/fork",
  VITE_DISCORD_LINK: "https://discord.example/invite",
  VITE_DONATE_LINK: "https://skinsrestorer.net/pricing",
};
const saved = Object.keys(pinned).map((key) => ({
  key,
  value: process.env[key],
}));
Object.assign(process.env, pinned);
const { getSiteRedirect, redirectLocation } = await import("./site-redirects");
for (const { key, value } of saved) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else process.env[key] = value;
}

test("retired documentation and Markdown URLs move permanently to the replacement", () => {
  assert.deepEqual(getSiteRedirect("/docs/features/skin-url"), {
    destination: "/docs/features/skin-upload",
    status: 308,
  });
  assert.deepEqual(getSiteRedirect("/docs/features/skin-url.mdx"), {
    destination: "/docs/features/skin-upload.mdx",
    status: 308,
  });
});

test("the retired troubleshooting page moves permanently, including its Markdown copy", () => {
  for (const [path, destination] of [
    [
      "/docs/troubleshooting/cannot-fetch-new-skins",
      "/docs/troubleshooting/firewall",
    ],
    [
      "/docs/troubleshooting/cannot-fetch-new-skins.mdx",
      "/docs/troubleshooting/firewall.mdx",
    ],
    [
      "/es/docs/troubleshooting/cannot-fetch-new-skins.mdx",
      "/es/docs/troubleshooting/firewall.mdx",
    ],
  ] as const) {
    assert.deepEqual(getSiteRedirect(path), { destination, status: 308 });
  }
});

test("pages moved to another docs section redirect permanently, with Markdown copies and locales", () => {
  for (const [path, destination] of [
    [
      "/docs/configuration/commands-permissions",
      "/docs/reference/commands-permissions",
    ],
    [
      "/es/docs/configuration/commands-permissions.mdx",
      "/es/docs/reference/commands-permissions.mdx",
    ],
    ["/docs/configuration/options", "/docs/reference"],
    ["/docs/configuration/options.mdx", "/docs/reference.mdx"],
    ["/docs/features/custom-skins", "/docs/configuration/custom-skins"],
    ["/ru/docs/features/custom-skins/", "/ru/docs/configuration/custom-skins"],
    ["/docs/development/inner-workings", "/docs/concepts/skin-lifecycle"],
    ["/docs/reference/documentation", "/docs"],
    ["/docs/reference/documentation.mdx", "/docs.mdx"],
    ["/pt-BR/docs/reference/documentation", "/pt-BR/docs"],
  ] as const) {
    assert.deepEqual(getSiteRedirect(path), { destination, status: 308 });
  }
});

test("the retired editor page moves permanently to the Studio in its locale", () => {
  assert.deepEqual(getSiteRedirect("/editor"), {
    destination: "/studio",
    status: 308,
  });
  assert.deepEqual(getSiteRedirect("/pt-BR/editor/"), {
    destination: "/pt-BR/studio",
    status: 308,
  });
});

test("legacy shortcuts resolve with temporary redirects, including trailing slashes", () => {
  for (const [path, destination] of [
    ["/skinurl", "/upload"],
    ["/perms/", "/docs/reference/commands-permissions"],
    ["/install", "/docs/installation"],
    ["/skinedit", "/docs/features/skin-edit"],
  ] as const) {
    assert.deepEqual(getSiteRedirect(path), { destination, status: 307 });
  }
});

test("external shortcuts go to the configured link in every locale", () => {
  for (const path of ["/github", "/es/github/"]) {
    assert.deepEqual(getSiteRedirect(path), {
      destination: "https://github.com/example/fork",
      status: 307,
    });
  }
  assert.deepEqual(getSiteRedirect("/ru/contributors"), {
    destination: "https://github.com/example/fork/graphs/contributors",
    status: 307,
  });
  assert.deepEqual(getSiteRedirect("/pt-BR/discord"), {
    destination: "https://discord.example/invite",
    status: 307,
  });
});

test("current and unknown routes pass through without redirects", () => {
  for (const path of [
    "/",
    "/studio",
    "/upload",
    "/generator",
    "/docs",
    "/docs/features/skin-upload",
    "/unknown",
  ]) {
    assert.equal(getSiteRedirect(path), undefined);
  }
});

test("localized shortcuts and retired documentation retain their locale", () => {
  assert.deepEqual(getSiteRedirect("/ru/docs/features/skin-url.mdx"), {
    destination: "/ru/docs/features/skin-upload.mdx",
    status: 308,
  });
  assert.deepEqual(getSiteRedirect("/es/donate"), {
    destination: "/es/pricing",
    status: 307,
  });
  assert.deepEqual(getSiteRedirect("/pt-BR/install"), {
    destination: "/pt-BR/docs/installation",
    status: 307,
  });
});

test("redirects on this site keep the query and hash", () => {
  const from = new URL("https://skinsrestorer.net/install?a=1#h");
  assert.equal(
    redirectLocation("/docs/installation", from),
    "/docs/installation?a=1#h",
  );
  assert.equal(
    redirectLocation("https://skinsrestorer.net/pricing", from),
    "/pricing?a=1#h",
  );
  // A target's own query stays when the request has none.
  assert.equal(
    redirectLocation(
      "/pricing?plan=pro",
      new URL("https://skinsrestorer.net/donate"),
    ),
    "/pricing?plan=pro",
  );
});

test("redirects to other sites drop the query and hash", () => {
  const from = new URL(
    "https://skinsrestorer.net/discord?texture=https%3A%2F%2Ftextures.minecraft.net%2Fx#private",
  );
  assert.equal(
    redirectLocation("https://discord.example/invite", from),
    "https://discord.example/invite",
  );
  // A protocol-relative target is another site, not a path on this one.
  assert.equal(
    redirectLocation("//discord.example/invite", from),
    "https://discord.example/invite",
  );
  assert.equal(
    redirectLocation("http://skinsrestorer.net/pricing", from),
    "http://skinsrestorer.net/pricing",
  );
});
