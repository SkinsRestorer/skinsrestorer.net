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

export async function pollMineSkinJob(
  jobId: string,
  waitMs = 1000,
): Promise<MineSkinJobSuccessResponse> {
  // Loop until the job is completed or failed.
  for (;;) {
    const jobData = await requestMineSkinJob(jobId);
    const { status } = jobData.job;

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
