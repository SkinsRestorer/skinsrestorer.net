import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { localizedSitePages } from "./site-pages";
import { splitLocalePath } from "./i18n";
import { GALLERY_URL } from "./skin-gallery";
import { TEXTURE_HOST } from "./skin-texture";
import { cspReportUrl, securityHeaders } from "./security-headers";

interface Rule {
  pattern: string;
  headers: [string, string][];
}

const headersFile = readFileSync(
  new URL("../../public/_headers", import.meta.url),
  "utf8",
);

function parseHeadersFile(source: string): Rule[] {
  const rules: Rule[] = [];
  for (const line of source.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (!/^\s/u.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] });
      continue;
    }
    const separator = line.indexOf(":");
    rules
      .at(-1)
      ?.headers.push([
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      ]);
  }
  return rules;
}

function matches(pattern: string, path: string) {
  return pattern.endsWith("/*")
    ? path.startsWith(pattern.slice(0, -1))
    : pattern === path;
}

/** Cloudflare joins the values of every matching rule with commas. */
function headerFor(rules: Rule[], path: string, name: string) {
  const values = rules
    .filter((rule) => matches(rule.pattern, path))
    .flatMap((rule) => rule.headers)
    .filter(([header]) => header.toLowerCase() === name.toLowerCase())
    .map(([, value]) => value);
  return values.length > 0 ? values.join(", ") : undefined;
}

function directives() {
  return new Map(
    securityHeaders["Content-Security-Policy"].split("; ").map((directive) => {
      const [name = "", ...sources] = directive.split(" ");
      return [name, sources] as const;
    }),
  );
}

const rules = parseHeadersFile(headersFile);

test("prerendered assets receive the same security headers as the worker", () => {
  for (const [name, value] of Object.entries(securityHeaders)) {
    assert.equal(headerFor(rules, "/docs/installation", name), value, name);
    assert.equal(headerFor(rules, "/assets/index.js", name), value, name);
  }
});

test("each prerendered page declares exactly its own language", () => {
  const paths = [
    ...localizedSitePages,
    "/docs",
    "/docs/installation/velocity",
    "/ru/docs",
    "/pt-BR/docs/troubleshooting",
  ];
  for (const path of paths) {
    assert.equal(
      headerFor(rules, path, "Content-Language"),
      splitLocalePath(path).locale,
      path,
    );
  }
  assert.equal(headerFor(rules, "/api/search", "Content-Language"), undefined);
});

test("_headers stays within Cloudflare limits", () => {
  assert.ok(rules.length <= 100);
  for (const line of headersFile.split("\n")) assert.ok(line.length <= 2000);
});

test("the policy allows the origins the site loads from", () => {
  const csp = directives();
  const textureOrigin = `https://${TEXTURE_HOST}`;
  const galleryOrigin = new URL(GALLERY_URL).origin;
  for (const origin of [textureOrigin, galleryOrigin]) {
    assert.ok(csp.get("img-src")?.includes(origin), origin);
    assert.ok(csp.get("connect-src")?.includes(origin), origin);
  }
  assert.ok(csp.get("img-src")?.includes("blob:"));
  assert.ok(csp.get("script-src")?.includes("https://analytics.ahrefs.com"));
  assert.ok(csp.get("frame-src")?.includes("https://ko-fi.com"));
});

test("the policy blocks plugins, base rewrites, and foreign framing", () => {
  const csp = directives();
  assert.deepEqual(csp.get("object-src"), ["'none'"]);
  assert.deepEqual(csp.get("base-uri"), ["'self'"]);
  assert.deepEqual(csp.get("frame-ancestors"), ["'self'"]);
});

test("violation reports go to the PostHog report endpoint", () => {
  const csp = directives();
  const url = new URL(cspReportUrl);
  assert.equal(url.pathname, "/report/");
  assert.match(url.searchParams.get("token") ?? "", /^phc_/u);
  assert.deepEqual(csp.get("report-uri"), [cspReportUrl]);
  assert.deepEqual(csp.get("report-to"), ["posthog"]);
  assert.equal(
    securityHeaders["Reporting-Endpoints"],
    `posthog="${cspReportUrl}"`,
  );
});
