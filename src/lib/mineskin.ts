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

export const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";

const MINESKIN_HEADERS = {
  "User-Agent": MINESKIN_USER_AGENT,
} as const;

function getMineSkinError(errors?: MineSkinError[]): string {
  return errors?.[0]?.message ?? "Job failed";
}

async function requestMineSkinJob(
  jobId: string,
): Promise<MineSkinJobSuccessResponse> {
  const jobResponse = await fetch(
    `https://api.mineskin.org/v2/queue/${jobId}`,
    {
      headers: MINESKIN_HEADERS,
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
  onStatusChange?: (status: MineSkinJobStatus) => void;
};

export async function pollMineSkinJob(
  jobId: string,
  options: PollMineSkinJobOptions = {},
): Promise<MineSkinJobSuccessResponse> {
  const waitMs = options.waitMs ?? 1000;
  // Loop until the job is completed or failed.
  for (;;) {
    const jobData = await requestMineSkinJob(jobId);
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
  waitMs?: number;
  callbacks?: MineSkinUploadCallbacks;
}

export async function uploadMineSkinFile({
  file,
  variant,
  name,
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

    const response = await fetch("https://api.mineskin.org/v2/queue", {
      method: "POST",
      headers: MINESKIN_HEADERS,
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
      onStatusChange: callbacks?.onStatusChange,
    });

    callbacks?.onComplete?.(completedJob);

    return completedJob;
  } catch (error) {
    callbacks?.onError?.(error);
    throw error;
  }
}
