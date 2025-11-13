import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";

export interface MineSkinError {
  message?: string;
}

export type MineSkinJobStatus =
  | "queued"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

const MINESKIN_API_BASE_URL = "https://api.mineskin.org/v2" as const;
const AXOLOTL_API_BASE_URL =
  "https://axolotl.skinsrestorer.net/mineskin" as const;

export interface MineSkinJobDetails {
  id: string;
  status: MineSkinJobStatus;
}

export interface MineSkinSkinTextureData {
  value: string;
  signature: string;
}

export interface MineSkinSkinData {
  uuid: string;
  url?: string;
  name?: string;
  texture: {
    data: MineSkinSkinTextureData;
  };
}

export interface MineSkinJobMessage {
  code: string;
  message: string;
}

export type MineSkinJobWarning = MineSkinError;

export type MineSkinEnqueueResponse =
  | {
      success: true;
      job: MineSkinJobDetails;
      errors?: MineSkinError[];
      warnings?: MineSkinJobWarning[];
      messages?: MineSkinJobMessage[];
    }
  | {
      success: false;
      job?: MineSkinJobDetails;
      errors?: MineSkinError[];
      warnings?: MineSkinJobWarning[];
      messages?: MineSkinJobMessage[];
    };

export type MineSkinJobResponse =
  | {
      success: true;
      job?: MineSkinJobDetails;
      skin: MineSkinSkinData;
      errors?: MineSkinError[];
      warnings?: MineSkinJobWarning[];
      messages?: MineSkinJobMessage[];
    }
  | {
      success: false;
      job?: MineSkinJobDetails;
      skin?: MineSkinSkinData;
      errors?: MineSkinError[];
      warnings?: MineSkinJobWarning[];
      messages?: MineSkinJobMessage[];
    };

export type MineSkinJobSuccessResponse = Extract<
  MineSkinJobResponse,
  { success: true }
>;

export const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";

function createAuthorizationHeader(apiKey?: string): string | undefined {
  if (!apiKey) {
    return undefined;
  }

  const trimmed = apiKey.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.startsWith("Bearer ") ? trimmed : `Bearer ${trimmed}`;
}

function createMineSkinHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": MINESKIN_USER_AGENT,
  };

  const authHeader = createAuthorizationHeader(apiKey);
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  return headers;
}

function getMineSkinError(errors?: MineSkinError[]): string {
  return errors?.[0]?.message ?? "Job failed";
}

async function requestMineSkinJob(
  jobId: string,
  apiKey?: string,
  useCapeProxy?: boolean,
): Promise<MineSkinJobSuccessResponse> {
  const jobUrl = useCapeProxy
    ? `${AXOLOTL_API_BASE_URL}/jobs/${jobId}`
    : `${MINESKIN_API_BASE_URL}/queue/${jobId}`;
  const jobResponse = await fetch(jobUrl, {
    headers: useCapeProxy
      ? { "User-Agent": MINESKIN_USER_AGENT }
      : createMineSkinHeaders(apiKey),
  });

  const jobData = (await jobResponse.json()) as
    | MineSkinJobResponse
    | { error: string };

  // Handle axolotl error format
  if (useCapeProxy && "error" in jobData) {
    throw new Error(jobData.error);
  }

  if ("success" in jobData && !jobData.success) {
    throw new Error(getMineSkinError(jobData.errors));
  }

  const successData = jobData as MineSkinJobSuccessResponse;
  if (!successData.job) {
    throw new Error("Job not found in response");
  }

  return successData;
}

export type PollMineSkinJobOptions = {
  waitMs?: number;
  onStatusChange?: (status: MineSkinJobStatus) => void;
};

export async function pollMineSkinJob(
  jobId: string,
  options: PollMineSkinJobOptions = {},
  apiKey?: string,
  useCapeProxy?: boolean,
): Promise<MineSkinJobSuccessResponse> {
  const waitMs = options.waitMs ?? 1000;
  // Loop until the job is completed or failed.
  for (;;) {
    const jobData = await requestMineSkinJob(jobId, apiKey, useCapeProxy);
    const job = jobData.job;
    if (!job) {
      throw new Error("Job not found in response");
    }

    const { status } = job;
    options.onStatusChange?.(status);

    if (status === "completed") {
      return jobData;
    }

    if (status === "failed") {
      throw new Error("Job failed to complete");
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }
}

export function getMineSkinErrorMessage(errors?: MineSkinError[]): string {
  return getMineSkinError(errors);
}

export type MineSkinUploadCallbacks = {
  onStart?: () => void;
  onEnqueue?: (job: MineSkinJobDetails) => void;
  onStatusChange?: (status: MineSkinJobStatus) => void;
  onComplete?: (result: MineSkinJobSuccessResponse) => void;
  onError?: (error: unknown) => void;
};

export interface MineSkinUploadOptions {
  file: File;
  variant: SkinVariant;
  name?: string;
  waitMs?: number;
  capeUuid?: string;
  apiKey?: string;
  callbacks?: MineSkinUploadCallbacks;
  useCapeProxy?: boolean;
}

export async function uploadMineSkinFile({
  file,
  variant,
  name,
  waitMs,
  capeUuid,
  apiKey,
  callbacks,
  useCapeProxy,
}: MineSkinUploadOptions): Promise<MineSkinJobSuccessResponse> {
  callbacks?.onStart?.();

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("variant", variant);
    if (name) {
      formData.append("name", name);
    }
    if (capeUuid) {
      formData.append(useCapeProxy ? "capeUuid" : "cape", capeUuid);
    }

    const enqueueUrl = useCapeProxy
      ? `${AXOLOTL_API_BASE_URL}/skins${waitMs ? `?waitMs=${waitMs}` : ""}`
      : `${MINESKIN_API_BASE_URL}/queue`;
    const response = await fetch(enqueueUrl, {
      method: "POST",
      headers: useCapeProxy
        ? { "User-Agent": MINESKIN_USER_AGENT }
        : createMineSkinHeaders(apiKey),
      body: formData,
    });

    const rawResponse = (await response.json()) as
      | MineSkinEnqueueResponse
      | MineSkinJobSuccessResponse
      | { error: string };

    // Handle axolotl error format
    if (useCapeProxy && "error" in rawResponse) {
      throw new Error(rawResponse.error);
    }

    if ("success" in rawResponse && !rawResponse.success) {
      throw new Error(getMineSkinError(rawResponse.errors));
    }

    // At this point, rawResponse should be a success response with job
    const job = (
      rawResponse as MineSkinEnqueueResponse | MineSkinJobSuccessResponse
    ).job;

    if (!job) {
      if ("skin" in rawResponse && rawResponse.skin) {
        callbacks?.onStatusChange?.("completed");
        callbacks?.onComplete?.(rawResponse);
        return rawResponse;
      }

      throw new Error("Job not found in response");
    }

    callbacks?.onEnqueue?.(job);
    callbacks?.onStatusChange?.(job.status);

    if ("skin" in rawResponse && rawResponse.skin) {
      callbacks?.onComplete?.(rawResponse);
      return rawResponse;
    }

    const completedJob = await pollMineSkinJob(
      job.id,
      {
        waitMs,
        onStatusChange: callbacks?.onStatusChange,
      },
      apiKey,
      useCapeProxy,
    );

    callbacks?.onComplete?.(completedJob);

    return completedJob;
  } catch (error) {
    callbacks?.onError?.(error);
    throw error;
  }
}

export interface MineSkinCape {
  uuid: string;
  alias: string;
  url: string;
  supported?: boolean;
}

export interface MineSkinCapeResponse {
  success?: boolean;
  capes?: MineSkinCape[];
  errors?: MineSkinError[];
}

export interface MineSkinMeResponse {
  success?: boolean;
  user: string;
  grants?: Record<string, unknown>;
  errors?: MineSkinError[];
}

export async function fetchMineSkinCapeGrant(apiKey: string): Promise<boolean> {
  const response = await fetch("https://api.mineskin.org/v2/me", {
    headers: createMineSkinHeaders(apiKey),
  });

  const data = (await response.json()) as MineSkinMeResponse;

  if (!response.ok || data.success === false) {
    throw new Error(getMineSkinError(data.errors));
  }

  const grants = data.grants ?? {};
  return Boolean((grants as Record<string, unknown>).capes);
}

export async function fetchMineSkinSupportedCapes(
  apiKey?: string,
): Promise<MineSkinCape[]> {
  const response = await fetch("https://api.mineskin.org/v2/capes", {
    headers: createMineSkinHeaders(apiKey),
  });

  const data = (await response.json()) as MineSkinCapeResponse;

  if (!response.ok || data.success === false) {
    throw new Error(getMineSkinError(data.errors));
  }

  return (data.capes ?? [])
    .filter((cape) => cape.supported)
    .map((cape) => ({
      ...cape,
      url: ensureHttpsTextureUrl(cape.url) ?? cape.url,
    }));
}

export async function fetchCapeSupport(apiKey: string): Promise<{
  hasCapeGrant: boolean;
  capes: MineSkinCape[];
}> {
  const hasCapeGrant = await fetchMineSkinCapeGrant(apiKey);

  if (!hasCapeGrant) {
    return {
      hasCapeGrant,
      capes: [],
    };
  }

  const capes = await fetchMineSkinSupportedCapes(apiKey);

  return {
    hasCapeGrant,
    capes,
  };
}
