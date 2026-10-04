import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchCapeSupport, uploadMineSkinFile } from "./mineskin";

const skin = {
  uuid: "skin-id",
  texture: { data: { value: "", signature: "" } },
};
const file = new File([new Uint8Array([1, 2, 3])], "skin.png", {
  type: "image/png",
});

const originalFetch = globalThis.fetch;

function mockFetch(implementation: typeof fetch) {
  const calls: Parameters<typeof fetch>[] = [];
  globalThis.fetch = (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("polls queued uploads and preserves credentials and cape fields", async () => {
  const responses = [
    { success: true, job: { id: "job-id", status: "queued" } },
    { success: true, job: { id: "job-id", status: "generating" } },
    { success: true, job: { id: "job-id", status: "completed" }, skin },
  ];
  const fetchMock = mockFetch(async () =>
    Response.json(responses.shift()),
  );

  const result = await uploadMineSkinFile({
    file,
    variant: "slim",
    capeUuid: "cape-id",
    apiKey: "  Bearer test-key  ",
    waitMs: 0,
  });

  assert.deepEqual(result.skin, skin);
  assert.equal(fetchMock.length, 3);
  const [enqueue, ...polls] = fetchMock;
  const options = enqueue[1] as RequestInit;
  const form = options.body as FormData;
  assert.equal(form.get("cape"), "cape-id");
  assert.equal(form.get("variant"), "slim");
  assert.equal(await (form.get("file") as File).text(), await file.text());
  for (const call of polls) {
    assert.equal(call[0], "https://api.mineskin.org/v2/queue/job-id");
    assert.equal(
      new Headers(call[1]?.headers).get("Authorization"),
      "Bearer test-key",
    );
  }
});

test("accepts immediate proxy results without forwarding the API key", async () => {
  const fetchMock = mockFetch(async () =>
    Response.json({ skin }),
  );
  const result = await uploadMineSkinFile({
    file,
    variant: "classic",
    capeUuid: "cape-id",
    apiKey: "private-key",
    useCapeProxy: true,
  });
  assert.deepEqual(result.skin, skin);
  assert.equal(fetchMock.length, 1);
  const [url, options] = fetchMock[0];
  assert.equal(url, "https://axolotl.skinsrestorer.net/mineskin/skins");
  assert.equal(new Headers(options?.headers).has("Authorization"), false);
  assert.ok(options?.body instanceof FormData);
  assert.equal(options.body.get("capeUuid"), "cape-id");
  assert.equal(options.body.has("cape"), false);
});

test("rejects failed or incomplete results instead of polling forever", async () => {
  const cases = [
    Response.json({ error: "Proxy unavailable" }, { status: 503 }),
    Response.json({ success: false, errors: [{ message: "Rejected" }] }),
    Response.json({ success: true, skin }, { status: 500 }),
    Response.json({ success: true, job: { id: "job-id", status: "failed" } }),
    Response.json({
      success: true,
      job: { id: "job-id", status: "completed" },
    }),
    Response.json({ success: true }),
  ];
  for (const response of cases) {
    const fetchMock = mockFetch(async () => response);
    await assert.rejects(
      uploadMineSkinFile({ file, variant: "classic", waitMs: 0 }),
    );
    assert.equal(fetchMock.length, 1);
    globalThis.fetch = originalFetch;
  }
});

test("does not fetch capes when the API key lacks access", async () => {
  const fetchMock = mockFetch(async () =>
    Response.json({ success: true, grants: {} }),
  );
  assert.deepEqual(await fetchCapeSupport("test-key"), {
    hasCapeGrant: false,
    capes: [],
  });
  assert.equal(fetchMock.length, 1);
});
