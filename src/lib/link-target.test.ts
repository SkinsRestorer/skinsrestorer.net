import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultParseSearch,
  defaultStringifySearch,
} from "@tanstack/react-router";
import { getLinkTarget } from "./link-target";

const options = {
  parseSearch: defaultParseSearch,
  stringifySearch: defaultStringifySearch,
};

test("site paths become router targets in the reader's locale", () => {
  const target = getLinkTarget("/docs/features?mode=a#gallery", "es", options);
  assert.ok(target);
  assert.equal(target.to, "/es/docs/features");
  assert.deepEqual({ ...target.search }, { mode: "a" });
  assert.equal(target.hash, "gallery");
  assert.deepEqual(getLinkTarget("/docs#установка", "en", options), {
    to: "/docs",
    hash: "установка",
  });
});

test("links to other sites are left to the browser", () => {
  for (const href of [
    "//evil.com",
    String.raw`/\evil.com`,
    "https://evil.com/docs",
    "mailto:team@skinsrestorer.net",
  ]) {
    assert.equal(getLinkTarget(href, "en", options), undefined, href);
  }
});

test("relative and query-only links are left to the browser", () => {
  for (const href of ["./other", "other.mdx", "../other", "?q=1", "#top"]) {
    assert.equal(getLinkTarget(href, "ru", options), undefined, href);
  }
});

test("a malformed fragment is left to the browser", () => {
  assert.equal(getLinkTarget("/docs#%E0%A4%A", "en", options), undefined);
});

test("a query the router would rewrite is left to the browser", () => {
  assert.equal(getLinkTarget("/docs?a=1&a=2", "en", options), undefined);
});
