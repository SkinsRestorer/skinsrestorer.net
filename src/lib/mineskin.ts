import { messageFields } from "./messages";
import { messageKeySchema, messageValuesSchema } from "./messages/schema";
import { Effect, Schedule, Schema } from "effect";
import {
  HttpError,
  type HttpReadOptions,
  readHttpJson,
  runHttpEffect,
} from "./effect-http";
import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";

const MINESKIN_API_BASE_URL = "https://api.mineskin.org/v2";
const AXOLOTL_API_BASE_URL = "https://axolotl.skinsrestorer.net/mineskin";
const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";
// Axolotl answers only after MineSkin generated the skin.
const AXOLOTL_UPLOAD_TIMEOUT_MS = 90_000;
// Polling stops here. The queued job can still finish on MineSkin.
const MINESKIN_JOB_DEADLINE = "2 minutes";
const MINESKIN_POLL_INTERVAL = "1 second";
// Job reads are idempotent, so transient failures retry after 1, 2, and 4 s.
const MINESKIN_POLL_RETRIES = 3;
const errorsSchema = Schema.optional(
  Schema.Array(Schema.Struct({ message: Schema.optional(Schema.String) })),
);
const skinSchema = Schema.Struct({
  uuid: Schema.String,
  url: Schema.optional(Schema.String),
  name: Schema.optional(Schema.NullOr(Schema.String)),
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
// Axolotl waits for completion and returns only an opaque URL.
const axolotlSkinSchema = Schema.Struct({
  url: Schema.String.check(Schema.isMinLength(1)),
});
const axolotlResponseSchema = Schema.Struct({
  error: Schema.optional(Schema.String),
  success: Schema.optional(Schema.Boolean),
  errors: errorsSchema,
  skin: Schema.optional(Schema.NullOr(axolotlSkinSchema)),
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
  capes: Schema.optional(Schema.Array(capeSchema)),
});
const grantsSchema = Schema.Struct({
  success: Schema.optional(Schema.Boolean),
  errors: errorsSchema,
  grants: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type MineSkinCape = typeof capeSchema.Type;

type MineSkinResponse = typeof responseSchema.Type;
export type MineSkinCompletedResponse =
  | (MineSkinResponse & { skin: typeof skinSchema.Type })
  | (typeof axolotlResponseSchema.Type & {
      skin: typeof axolotlSkinSchema.Type;
    });

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a class factory.
class MineSkinError extends Schema.TaggedError<
  MineSkinError,
  { readonly brand: unique symbol }
>()("MineSkinError", {
  reason: Schema.Literals(["request", "job", "result"]),
  message: Schema.String,
  status: Schema.optional(Schema.Finite),
  messageKey: Schema.optional(messageKeySchema),
  messageValues: Schema.optional(messageValuesSchema),
}) {}

function createMineSkinHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": MINESKIN_USER_AGENT };
  const key = apiKey?.trim();
  if (key)
    headers["Authorization"] = key.startsWith("Bearer ")
      ? key
      : `Bearer ${key}`;
  return headers;
}

interface MineSkinBody {
  success?: boolean | undefined;
  errors?: readonly { message?: string | undefined }[] | undefined;
  error?: string | undefined;
}

function mineSkinRequest<A extends MineSkinBody>(
  url: string,
  init: RequestInit,
  schema: Schema.Decoder<A>,
  options?: HttpReadOptions,
) {
  return readHttpJson(url, init, schema, options).pipe(
    Effect.flatMap((response) => {
      const detail = response.data.error ?? response.data.errors?.[0]?.message;
      if (
        response.data.error ||
        !response.ok ||
        response.data.success === false
      )
        return Effect.fail(
          MineSkinError.make({
            reason: "request",
            status: response.status,
            ...(detail !== undefined
              ? { message: detail }
              : messageFields("errors.mineskinStatus", {
                  status: response.status,
                })),
          }),
        );
      return Effect.succeed(response.data);
    }),
  );
}

/**
 * An upload that times out may already be accepted, so the error says so
 * instead of inviting a blind resubmit.
 */
function mineSkinUpload<A extends MineSkinBody>(
  url: string,
  init: RequestInit,
  schema: Schema.Decoder<A>,
  options?: HttpReadOptions,
) {
  return mineSkinRequest(url, init, schema, options).pipe(
    Effect.mapError((error) =>
      error._tag === "HttpError" && error.reason === "timeout"
        ? HttpError.make({
            reason: "timeout",
            ...messageFields("errors.uploadTimedOut"),
          })
        : error,
    ),
  );
}

const isTransientStatus = (status: number | undefined) =>
  status !== undefined && (status === 429 || status >= 500);

/**
 * Network failures, timeouts, rate limits, and server errors can pass. A proxy
 * often answers a 502 or 503 with an HTML page, which fails JSON decoding.
 */
function isTransientPollError(error: HttpError | MineSkinError): boolean {
  if (error._tag === "HttpError")
    return error.reason === "response" ? isTransientStatus(error.status) : true;
  return error.reason === "request" && isTransientStatus(error.status);
}

/**
 * Read the state of an accepted job. Transient failures retry, since the read
 * is idempotent. When they persist, the error says the job may still finish
 * instead of inviting a second upload.
 */
function readMineSkinJob(url: string, headers: Record<string, string>) {
  return mineSkinRequest(url, { headers }, responseSchema).pipe(
    Effect.retry({
      schedule: Schedule.exponential("1 second"),
      times: MINESKIN_POLL_RETRIES,
      while: isTransientPollError,
    }),
    Effect.mapError((error) =>
      isTransientPollError(error)
        ? MineSkinError.make({
            reason: "job",
            ...messageFields("errors.jobStatusUnavailable"),
          })
        : error,
    ),
  );
}

export interface MineSkinUploadOptions {
  file: File;
  variant: SkinVariant;
  name?: string | undefined;
  capeUuid?: string | undefined;
  apiKey?: string | undefined;
  useCapeProxy?: boolean;
}

/** Poll an existing job. It never submits the upload again. */
const pollMineSkinJob = Effect.fn("MineSkin.pollJob")(function* (
  queued: MineSkinResponse,
  headers: Record<string, string>,
) {
  let data = queued;
  for (;;) {
    if (data.job?.status === "failed")
      return yield* MineSkinError.make({
        reason: "job",
        ...messageFields("errors.jobIncomplete"),
      });
    if (data.skin) return { ...data, skin: data.skin };
    if (!data.job)
      return yield* MineSkinError.make({
        reason: "job",
        ...messageFields("errors.jobMissing"),
      });
    if (data.job.status === "completed") {
      if (data.job.result) {
        const result = yield* readMineSkinJob(
          `${MINESKIN_API_BASE_URL}/skins/${encodeURIComponent(data.job.result)}`,
          headers,
        );
        if (result.skin) return { ...data, skin: result.skin };
      }
      return yield* MineSkinError.make({
        reason: "result",
        ...messageFields("errors.resultMissing"),
      });
    }
    const jobUrl = `${MINESKIN_API_BASE_URL}/queue/${encodeURIComponent(data.job.id)}`;
    yield* Effect.sleep(MINESKIN_POLL_INTERVAL);
    data = yield* readMineSkinJob(jobUrl, headers);
  }
});

/** Submit once, then poll the existing job. Interruption never resubmits an upload. */
export const uploadMineSkinFileEffect = Effect.fn("MineSkin.upload")(
  function* ({
    file,
    variant,
    name,
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
    if (useCapeProxy) {
      const data = yield* mineSkinUpload(
        `${AXOLOTL_API_BASE_URL}/skins`,
        { method: "POST", headers, body: formData },
        axolotlResponseSchema,
        { timeoutMs: AXOLOTL_UPLOAD_TIMEOUT_MS },
      );
      if (!data.skin)
        return yield* MineSkinError.make({
          reason: "result",
          ...messageFields("errors.resultMissing"),
        });
      return { ...data, skin: data.skin };
    }
    const queued = yield* mineSkinUpload(
      `${MINESKIN_API_BASE_URL}/queue`,
      { method: "POST", headers, body: formData },
      responseSchema,
    );
    return yield* pollMineSkinJob(queued, headers).pipe(
      Effect.timeoutOrElse({
        duration: MINESKIN_JOB_DEADLINE,
        orElse: () =>
          Effect.fail(
            MineSkinError.make({
              reason: "job",
              ...messageFields("errors.jobTimedOut"),
            }),
          ),
      }),
    );
  },
);

const fetchMineSkinCapeGrantEffect = Effect.fn("MineSkin.capeGrant")(function* (
  apiKey: string,
) {
  const data = yield* mineSkinRequest(
    `${MINESKIN_API_BASE_URL}/me`,
    { headers: createMineSkinHeaders(apiKey) },
    grantsSchema,
  );
  return Boolean(data.grants?.["capes"]);
});
const fetchMineSkinSupportedCapesEffect = Effect.fn("MineSkin.supportedCapes")(
  function* (apiKey?: string) {
    const data = yield* mineSkinRequest(
      `${MINESKIN_API_BASE_URL}/capes`,
      { headers: createMineSkinHeaders(apiKey) },
      capesSchema,
    );
    return (data.capes ?? [])
      .filter((cape) => cape.supported)
      .map((cape): MineSkinCape => ({
        uuid: cape.uuid,
        alias: cape.alias,
        url: ensureHttpsTextureUrl(cape.url) ?? cape.url,
        supported: true,
      }));
  },
);
const fetchCapeSupportEffect = Effect.fn("MineSkin.capeSupport")(function* (
  apiKey: string,
) {
  const hasCapeGrant = yield* fetchMineSkinCapeGrantEffect(apiKey);
  return {
    hasCapeGrant,
    capes: hasCapeGrant ? yield* fetchMineSkinSupportedCapesEffect(apiKey) : [],
  };
});
// React event handlers and external callers consume Promises at this boundary.
export const uploadMineSkinFile = (
  options: MineSkinUploadOptions,
  signal?: AbortSignal,
): Promise<MineSkinCompletedResponse> =>
  runHttpEffect(uploadMineSkinFileEffect(options), signal);

export const fetchMineSkinSupportedCapes = (
  apiKey?: string,
  signal?: AbortSignal,
) => runHttpEffect(fetchMineSkinSupportedCapesEffect(apiKey), signal);
export const fetchCapeSupport = (apiKey: string, signal?: AbortSignal) =>
  runHttpEffect(fetchCapeSupportEffect(apiKey), signal);
