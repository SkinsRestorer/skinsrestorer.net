import { Data, Effect, Schema } from "effect";
import { readHttpJson, readHttpText, runHttpEffect } from "./effect-http";
import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";

const MINESKIN_API_BASE_URL = "https://api.mineskin.org/v2";
const AXOLOTL_API_BASE_URL = "https://axolotl.skinsrestorer.net/mineskin";
export const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";
const errorsSchema = Schema.optional(
  Schema.Array(Schema.Struct({ message: Schema.optional(Schema.String) })),
);
const skinSchema = Schema.Struct({
  uuid: Schema.String,
  url: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  texture: Schema.Struct({
    data: Schema.Struct({ value: Schema.String, signature: Schema.String }),
  }),
});
const responseSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  success: Schema.optional(Schema.Boolean),
  errors: errorsSchema,
  job: Schema.optional(
    Schema.Struct({
      id: Schema.String,
      status: Schema.Literals([
        "unknown",
        "waiting",
        "active",
        "processing",
        "completed",
        "failed",
      ]),
      result: Schema.optional(Schema.String),
    }),
  ),
  skin: Schema.optional(
    Schema.Union([skinSchema, Schema.Literal(false), Schema.Null]),
  ),
});
const capeSchema = Schema.Struct({
  uuid: Schema.String,
  alias: Schema.String,
  url: Schema.String,
  supported: Schema.optional(Schema.Boolean),
});
const capesSchema = Schema.Struct({
  success: Schema.optional(Schema.Boolean),
  errors: errorsSchema,
  capes: Schema.optional(Schema.mutable(Schema.Array(capeSchema))),
});
const grantsSchema = Schema.Struct({
  success: Schema.optional(Schema.Boolean),
  errors: errorsSchema,
  grants: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type MineSkinCape = typeof capeSchema.Type;
export type MineSkinCapeResponse = typeof capesSchema.Type;
export type MineSkinMeResponse = typeof grantsSchema.Type;
type MineSkinResponse = typeof responseSchema.Type;
export type MineSkinCompletedResponse = MineSkinResponse & {
  skin: typeof skinSchema.Type;
};

export class MineSkinError extends Data.TaggedError("MineSkinError")<{
  readonly reason: "request" | "job" | "result";
  readonly message: string;
}> {}

function createMineSkinHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": MINESKIN_USER_AGENT };
  const key = apiKey?.trim();
  if (key)
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  return headers;
}

function mineSkinRequest<
  A extends {
    success?: boolean;
    errors?: readonly { message?: string }[];
    error?: string;
  },
>(url: string, init: RequestInit, schema: Schema.Decoder<A>) {
  return readHttpJson(url, init, schema).pipe(
    Effect.flatMap((response) => {
      if (
        response.data.error ||
        !response.ok ||
        response.data.success === false
      )
        return Effect.fail(
          new MineSkinError({
            reason: "request",
            message:
              response.data.error ??
              response.data.errors?.[0]?.message ??
              "Job failed",
          }),
        );
      return Effect.succeed(response.data);
    }),
  );
}

export interface MineSkinUploadOptions {
  file: File;
  variant: SkinVariant;
  name?: string;
  waitMs?: number;
  capeUuid?: string;
  apiKey?: string;
  useCapeProxy?: boolean;
}

/** Submit once, then poll the existing job. Interruption never resubmits an upload. */
export const uploadMineSkinFileEffect = Effect.fn("MineSkin.upload")(
  function* ({
    file,
    variant,
    name,
    waitMs,
    capeUuid,
    apiKey,
    useCapeProxy = false,
  }: MineSkinUploadOptions) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("variant", variant);
    if (name) formData.append("name", name);
    if (capeUuid) formData.append(useCapeProxy ? "capeUuid" : "cape", capeUuid);
    const headers = createMineSkinHeaders(useCapeProxy ? undefined : apiKey);
    const enqueueUrl = useCapeProxy
      ? `${AXOLOTL_API_BASE_URL}/skins${waitMs ? `?waitMs=${waitMs}` : ""}`
      : `${MINESKIN_API_BASE_URL}/queue`;
    let data = yield* mineSkinRequest(
      enqueueUrl,
      { method: "POST", headers, body: formData },
      responseSchema,
    );
    for (;;) {
      if (data.job?.status === "failed")
        return yield* new MineSkinError({
          reason: "job",
          message: "Job failed to complete",
        });
      if (data.skin) return { ...data, skin: data.skin };
      if (!data.job)
        return yield* new MineSkinError({
          reason: "job",
          message: "Job not found in response",
        });
      if (data.job.status === "completed") {
        if (!useCapeProxy && data.job.result) {
          const result = yield* mineSkinRequest(
            `${MINESKIN_API_BASE_URL}/skins/${encodeURIComponent(data.job.result)}`,
            { headers },
            responseSchema,
          );
          if (result.skin) return { ...data, skin: result.skin };
        }
        return yield* new MineSkinError({
          reason: "result",
          message: "Skin not found in completed job response",
        });
      }
      const jobUrl = useCapeProxy
        ? `${AXOLOTL_API_BASE_URL}/jobs/${encodeURIComponent(data.job.id)}`
        : `${MINESKIN_API_BASE_URL}/queue/${encodeURIComponent(data.job.id)}`;
      yield* Effect.sleep(waitMs ?? 1000);
      data = yield* mineSkinRequest(jobUrl, { headers }, responseSchema);
    }
  },
);

export const fetchMineSkinCapeGrantEffect = Effect.fn("MineSkin.capeGrant")(
  function* (apiKey: string) {
    const data = yield* mineSkinRequest(
      `${MINESKIN_API_BASE_URL}/me`,
      { headers: createMineSkinHeaders(apiKey) },
      grantsSchema,
    );
    return Boolean(data.grants?.capes);
  },
);
export const fetchMineSkinSupportedCapesEffect = Effect.fn(
  "MineSkin.supportedCapes",
)(function* (apiKey?: string) {
  const data = yield* mineSkinRequest(
    `${MINESKIN_API_BASE_URL}/capes`,
    { headers: createMineSkinHeaders(apiKey) },
    capesSchema,
  );
  return (data.capes ?? [])
    .filter((cape) => cape.supported)
    .map((cape) => ({
      ...cape,
      url: ensureHttpsTextureUrl(cape.url) ?? cape.url,
    }));
});
export const fetchCapeSupportEffect = Effect.fn("MineSkin.capeSupport")(
  function* (apiKey: string) {
    const hasCapeGrant = yield* fetchMineSkinCapeGrantEffect(apiKey);
    return {
      hasCapeGrant,
      capes: hasCapeGrant
        ? yield* fetchMineSkinSupportedCapesEffect(apiKey)
        : [],
    };
  },
);
export const fetchMineSkinStatusEffect = readHttpText(
  `${MINESKIN_API_BASE_URL}/delay`,
  {
    headers: createMineSkinHeaders(),
  },
).pipe(Effect.map((response) => response.ok));

// React event handlers and external callers consume Promises at this boundary.
export const uploadMineSkinFile = (
  options: MineSkinUploadOptions,
  signal?: AbortSignal,
): Promise<MineSkinCompletedResponse> =>
  runHttpEffect(uploadMineSkinFileEffect(options), signal);
export const fetchMineSkinCapeGrant = (apiKey: string, signal?: AbortSignal) =>
  runHttpEffect(fetchMineSkinCapeGrantEffect(apiKey), signal);
export const fetchMineSkinSupportedCapes = (
  apiKey?: string,
  signal?: AbortSignal,
) => runHttpEffect(fetchMineSkinSupportedCapesEffect(apiKey), signal);
export const fetchCapeSupport = (apiKey: string, signal?: AbortSignal) =>
  runHttpEffect(fetchCapeSupportEffect(apiKey), signal);
