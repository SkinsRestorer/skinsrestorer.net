import type { HttpFetch } from "./effect-http";
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

function mockFetch(implementation: HttpFetch) {
  const calls: Parameters<HttpFetch>[] = [];
  globalThis.fetch = Object.assign((...args: Parameters<HttpFetch>) => {
    calls.push(args);
    return implementation(...args);
  }, originalFetch);
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("polls queued uploads and preserves credentials and cape fields", async () => {
  const responses = [
    { success: true, job: { id: "job-id", status: "waiting" } },
    { success: true, job: { id: "job-id", status: "active" } },
    { success: true, job: { id: "job-id", status: "completed" }, skin },
  ];
  const fetchMock = mockFetch(async () => Response.json(responses.shift()));

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

test("loads completed job results when the skin is not included", async () => {
  for (const queued of [false, true]) {
    const job = { id: "job-id", status: "completed", result: skin.uuid };
    const responses = [
      ...(queued
        ? [{ success: true, job: { id: job.id, status: "waiting" } }]
        : []),
      { success: true, job, skin: queued ? false : null },
      { success: true, skin },
    ];
    const fetchMock = mockFetch(async () => Response.json(responses.shift()));

    const result = await uploadMineSkinFile({
      file,
      variant: "classic",
      apiKey: "test-key",
      waitMs: 0,
    });

    assert.deepEqual(result.skin, skin);
    assert.deepEqual("job" in result && result.job, job);
    assert.equal(fetchMock.length, queued ? 3 : 2);
    const request = fetchMock.at(-1)!;
    assert.equal(request[0], `https://api.mineskin.org/v2/skins/${skin.uuid}`);
    assert.equal(
      new Headers(request[1]?.headers).get("Authorization"),
      "Bearer test-key",
    );
    globalThis.fetch = originalFetch;
  }
});

test("accepts null names in cached, queued, and fetched MineSkin results", async () => {
  // Public MineSkin skin responses include name: null for unnamed skins.
  const unnamedSkin = { ...skin, name: null };
  const completed = {
    success: true,
    job: { id: "job-id", status: "completed", result: skin.uuid },
    skin: unnamedSkin,
  };
  for (const responses of [
    [completed],
    [{ success: true, job: { id: "job-id", status: "waiting" } }, completed],
    [
      { ...completed, skin: false },
      { success: true, skin: unnamedSkin },
    ],
  ]) {
    const expectedRequests = responses.length;
    const calls = mockFetch(async () => Response.json(responses.shift()));
    const result = await uploadMineSkinFile({
      file,
      variant: "slim",
      waitMs: 0,
    });
    assert.deepEqual(result.skin, unnamedSkin);
    assert.equal(calls.length, expectedRequests);
    assert.equal(calls.filter(([, init]) => init?.method === "POST").length, 1);
    globalThis.fetch = originalFetch;
  }
});

test("rejects missing or failed skin lookups without resubmitting the upload", async () => {
  for (const response of [
    Response.json({ success: true, skin: false }),
    Response.json({ success: false }, { status: 404 }),
  ]) {
    const responses = [
      Response.json({
        success: true,
        job: { id: "job-id", status: "completed", result: skin.uuid },
      }),
      response,
    ];
    const fetchMock = mockFetch(async () => responses.shift()!);

    await assert.rejects(
      uploadMineSkinFile({ file, variant: "classic", waitMs: 0 }),
    );
    assert.equal(fetchMock.length, 2);
    globalThis.fetch = originalFetch;
  }
});

test("accepts immediate proxy results without forwarding the API key", async () => {
  const proxySkin = { url: "skinsrestorer-axolotl://v2.test-payload" };
  const fetchMock = mockFetch(async () =>
    Response.json({
      success: true,
      skin: proxySkin,
      warnings: [],
      messages: [],
    }),
  );
  const result = await uploadMineSkinFile({
    file,
    variant: "classic",
    capeUuid: "cape-id",
    apiKey: "private-key",
    useCapeProxy: true,
  });
  assert.deepEqual(result.skin, proxySkin);
  assert.equal(fetchMock.length, 1);
  const [url, options] = fetchMock[0];
  assert.equal(url, "https://axolotl.skinsrestorer.net/mineskin/skins");
  assert.equal(new Headers(options?.headers).has("Authorization"), false);
  assert.ok(options?.body instanceof FormData);
  assert.equal(options.body.get("capeUuid"), "cape-id");
  assert.equal(options.body.has("cape"), false);
});

test("rejects missing proxy results and errors without retrying the upload", async () => {
  for (const body of [
    { success: true, skin: null, warnings: [], messages: [] },
    { success: true },
    { success: true, skin: {} },
    { success: true, skin: { url: "" } },
    { success: false, errors: [{ message: "Rejected" }] },
    { error: "Proxy unavailable" },
  ]) {
    const calls = mockFetch(async () => Response.json(body));
    await assert.rejects(
      uploadMineSkinFile({
        file,
        variant: "classic",
        capeUuid: "cape-id",
        useCapeProxy: true,
      }),
    );
    assert.equal(calls.length, 1);
    globalThis.fetch = originalFetch;
  }
});

test("the official MineSkin route still requires full skin metadata", async () => {
  const calls = mockFetch(async () =>
    Response.json({
      success: true,
      skin: { url: "https://minesk.in/skin-id" },
    }),
  );
  await assert.rejects(
    uploadMineSkinFile({ file, variant: "classic" }),
    /invalid response/,
  );
  assert.equal(calls.length, 1);
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

test("Effect polling uses virtual time and interruption never resubmits an upload", async () => {
  const { Effect, Fiber } = await import("effect");
  const { TestClock } = await import("effect/testing");
  const { HttpClient } = await import("./effect-http");
  const { uploadMineSkinFileEffect } = await import("./mineskin");
  let calls = 0;
  await Effect.runPromise(
    Effect.gen(function* () {
      const upload = yield* Effect.forkChild(
        uploadMineSkinFileEffect({ file, variant: "classic" }),
      );
      yield* TestClock.adjust(999);
      assert.equal(calls, 1);
      yield* TestClock.adjust(1);
      assert.equal(calls, 2);
      yield* Fiber.interrupt(upload);
      yield* TestClock.adjust(10_000);
      assert.equal(calls, 2);
    }).pipe(
      Effect.provideService(HttpClient, {
        fetch: async () => {
          calls++;
          return Response.json({ job: { id: "job", status: "waiting" } });
        },
      }),
      Effect.provide(TestClock.layer()),
    ),
  );
});

test("supported capes are normalized and private fields are validated at the boundary", async () => {
  const { fetchMineSkinSupportedCapes } = await import("./mineskin");
  mockFetch(async () =>
    Response.json({
      capes: [
        {
          uuid: "yes",
          alias: "Cape",
          url: "http://textures.example/cape",
          supported: true,
        },
        {
          uuid: "no",
          alias: "No",
          url: "http://textures.example/no",
          supported: false,
        },
      ],
    }),
  );
  assert.deepEqual(await fetchMineSkinSupportedCapes(), [
    {
      uuid: "yes",
      alias: "Cape",
      url: "https://textures.example/cape",
      supported: true,
    },
  ]);
});
