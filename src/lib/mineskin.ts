import type { SkinVariant } from "./skin";

export interface MineSkinError {
  message?: string;
}

export type MineSkinJobStatus =
  | "queued"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

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
  name?: string;
  texture: {
    data: MineSkinSkinTextureData;
  };
}

export type MineSkinEnqueueResponse =
  | {
      success: true;
      job: MineSkinJobDetails;
      errors?: MineSkinError[];
    }
  | {
      success: false;
      job?: MineSkinJobDetails;
      errors?: MineSkinError[];
    };

export type MineSkinJobResponse =
  | {
      success: true;
      job: MineSkinJobDetails;
      skin: MineSkinSkinData;
      errors?: MineSkinError[];
    }
  | {
      success: false;
      job?: MineSkinJobDetails;
      skin?: MineSkinSkinData;
      errors?: MineSkinError[];
    };

export type MineSkinJobSuccessResponse = Extract<
  MineSkinJobResponse,
  { success: true }
>;

export interface MineSkinCape {
  uuid: string;
  alias: string;
  url: string;
  supported?: boolean;
}

export type MineSkinGrants = Record<string, unknown>;

export interface MineSkinCapeListResponse {
  capes: MineSkinCape[];
}

export interface MineSkinMeResponse {
  user: string;
  grants: MineSkinGrants;
}

export const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";

const MINESKIN_API_BASE = "https://api.mineskin.org";

function formatMineSkinApiKey(apiKey: string): string {
  return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
}

function createMineSkinHeaders(apiKey?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent": MINESKIN_USER_AGENT,
  };

  if (apiKey && apiKey.trim().length > 0) {
    headers.Authorization = formatMineSkinApiKey(apiKey.trim());
  }

  return headers;
}

async function parseMineSkinErrorResponse(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      errors?: MineSkinError[];
      message?: string;
    };

    if (data.errors && data.errors.length > 0) {
      return getMineSkinError(data.errors);
    }

    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
  } catch (_error) {
    // Ignore JSON parsing issues and fall back to status text below.
  }

  return response.statusText || "MineSkin API request failed";
}

function getMineSkinError(errors?: MineSkinError[]): string {
  return errors?.[0]?.message ?? "Job failed";
}

async function requestMineSkinJob(
  jobId: string,
  apiKey?: string | null,
): Promise<MineSkinJobSuccessResponse> {
  const jobResponse = await fetch(
    `${MINESKIN_API_BASE}/v2/queue/${jobId}`,
    {
      headers: createMineSkinHeaders(apiKey),
    },
  );

  const jobData = (await jobResponse.json()) as MineSkinJobResponse;

  if (!jobData.success) {
    throw new Error(getMineSkinError(jobData.errors));
  }

  return jobData;
}

export type PollMineSkinJobOptions = {
  waitMs?: number;
  apiKey?: string | null;
  onStatusChange?: (status: MineSkinJobStatus) => void;
};

export async function pollMineSkinJob(
  jobId: string,
  options: PollMineSkinJobOptions = {},
): Promise<MineSkinJobSuccessResponse> {
  const waitMs = options.waitMs ?? 1000;
  // Loop until the job is completed or failed.
  for (;;) {
    const jobData = await requestMineSkinJob(jobId, options.apiKey);
    const { status } = jobData.job;
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
  capeUuid?: string | null;
  apiKey?: string | null;
  waitMs?: number;
  callbacks?: MineSkinUploadCallbacks;
}

export async function uploadMineSkinFile({
  file,
  variant,
  name,
  capeUuid,
  apiKey,
  waitMs,
  callbacks,
}: MineSkinUploadOptions): Promise<MineSkinJobSuccessResponse> {
  callbacks?.onStart?.();

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("variant", variant);
    if (name) {
      formData.append("name", name);
    }

    if (capeUuid && capeUuid.trim().length > 0) {
      formData.append("cape", capeUuid.trim());
    }

    const response = await fetch(`${MINESKIN_API_BASE}/v2/queue`, {
      method: "POST",
      headers: createMineSkinHeaders(apiKey),
      body: formData,
    });

    const rawResponse = (await response.json()) as MineSkinEnqueueResponse;

    if (!rawResponse.success) {
      throw new Error(getMineSkinError(rawResponse.errors));
    }

    const job = rawResponse.job;
    callbacks?.onEnqueue?.(job);
    callbacks?.onStatusChange?.(job.status);

    const completedJob = await pollMineSkinJob(job.id, {
      waitMs,
      apiKey,
      onStatusChange: callbacks?.onStatusChange,
    });

    callbacks?.onComplete?.(completedJob);

    return completedJob;
  } catch (error) {
    callbacks?.onError?.(error);
    throw error;
  }
}

export async function fetchMineSkinCapes(
  apiKey?: string | null,
): Promise<MineSkinCape[]> {
  const response = await fetch(`${MINESKIN_API_BASE}/v2/capes`, {
    headers: createMineSkinHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(await parseMineSkinErrorResponse(response));
  }

  const data = (await response.json()) as MineSkinCapeListResponse;
  return data.capes ?? [];
}

export async function fetchMineSkinMe(
  apiKey: string,
): Promise<MineSkinMeResponse> {
  const response = await fetch(`${MINESKIN_API_BASE}/v2/me`, {
    headers: createMineSkinHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(await parseMineSkinErrorResponse(response));
  }

  return (await response.json()) as MineSkinMeResponse;
}
