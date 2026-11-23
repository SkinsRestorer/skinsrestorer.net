import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { readDocsTree } from "./docs-tree";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function serve(
  respond: (url: string, init?: RequestInit) => Promise<Response>,
) {
  const requested: string[] = [];
  globalThis.fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      requested.push(url);
      return respond(url, init);
    },
    { preconnect: originalFetch.preconnect },
  );
  return requested;
}

const tree = {
  $fumadocs_loader: "page-tree",
  data: { name: "Docs", children: [] },
};

test("reads the tree file of the requested locale", async () => {
  const requested = serve(() => Promise.resolve(Response.json(tree)));
  assert.deepEqual(await readDocsTree("pt-BR"), tree);
  assert.deepEqual(requested, ["/api/docs-tree/pt-BR"]);
});

test("a missing tree file fails instead of rendering an empty sidebar", async () => {
  serve(() =>
    Promise.resolve(new Response("<!doctype html>", { status: 404 })),
  );
  await assert.rejects(readDocsTree("en"));
  serve(() => Promise.resolve(Response.json(tree, { status: 503 })));
  await assert.rejects(readDocsTree("en"), { _tag: "DocsTreeLoadError" });
});

test("a response that is not a page tree fails", async () => {
  serve(() => Promise.resolve(Response.json({ type: "i18n", data: {} })));
  await assert.rejects(readDocsTree("en"));
});

test("a superseded navigation cancels the read", async () => {
  serve(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
  );
  const controller = new AbortController();
  const read = readDocsTree("ru", controller.signal);
  controller.abort();
  await assert.rejects(read, { name: "AbortError" });
});
