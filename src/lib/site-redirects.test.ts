import assert from "node:assert/strict";
import { test } from "node:test";
import { getSiteRedirect } from "./site-redirects";

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
    ["/perms/", "/docs/configuration/commands-permissions"],
    ["/install", "/docs/installation"],
    ["/skinedit", "/docs/features/skin-edit"],
    [
      "/docs/troubleshooting/cannot-fetch-new-skins",
      "/docs/troubleshooting/firewall",
    ],
  ]) {
    assert.deepEqual(getSiteRedirect(path), { destination, status: 307 });
  }
  assert.equal(
    getSiteRedirect("/github")?.destination,
    import.meta.env.VITE_GITHUB_LINK ??
      "https://github.com/SkinsRestorer/SkinsRestorer",
  );
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
  assert.deepEqual(getSiteRedirect("/pt-BR/install"), {
    destination: "/pt-BR/docs/installation",
    status: 307,
  });
});
