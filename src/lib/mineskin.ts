import type { SkinVariant } from "./skin";
import { ensureHttpsTextureUrl } from "./textures";

interface MineSkinError {
  message?: string;
}

type MineSkinJobStatus =
  | "queued"
  | "pending"
  | "generating"
  | "completed"
  | "failed";

const MINESKIN_API_BASE_URL = "https://api.mineskin.org/v2";
const AXOLOTL_API_BASE_URL = "https://axolotl.skinsrestorer.net/mineskin";
export const MINESKIN_USER_AGENT = "SkinsRestorer-Generator/1.0";

interface MineSkinJobDetails {
  id: string;
  status: MineSkinJobStatus;
}

interface MineSkinSkinData {
  uuid: string;
  url?: string;
  name?: string;
  texture: {
    data: {
      value: string;
      signature: string;
    };
  };
}

interface MineSkinResponse {
  success?: boolean;
  job?: MineSkinJobDetails;
  skin?: MineSkinSkinData;
  errors?: MineSkinError[];
}

type MineSkinCompletedResponse = MineSkinResponse & { skin: MineSkinSkinData };

function createMineSkinHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": MINESKIN_USER_AGENT,
  };
  const key = apiKey?.trim();
  if (key) {
    headers.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  }
  return headers;
}

function getMineSkinError(errors?: MineSkinError[]): string {
  return errors?.[0]?.message ?? "Job failed";
}

async function readMineSkinResponse(
  response: Response,
): Promise<MineSkinResponse> {
  const data = (await response.json()) as MineSkinResponse | { error: string };
  if ("error" in data) {
    throw new Error(data.error);
  }
  if (!response.ok || data.success === false) {
    throw new Error(getMineSkinError(data.errors));
  }
  return data;
}

interface MineSkinUploadOptions {
  file: File;
  variant: SkinVariant;
  name?: string;
  waitMs?: number;
  capeUuid?: string;
  apiKey?: string;
  useCapeProxy?: boolean;
}

export async function uploadMineSkinFile({
  file,
  variant,
  name,
  waitMs,
  capeUuid,
  apiKey,
  useCapeProxy = false,
}: MineSkinUploadOptions): Promise<MineSkinCompletedResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("variant", variant);
  if (name) formData.append("name", name);
  if (capeUuid) formData.append(useCapeProxy ? "capeUuid" : "cape", capeUuid);

  const headers = createMineSkinHeaders(useCapeProxy ? undefined : apiKey);
  const enqueueUrl = useCapeProxy
    ? `${AXOLOTL_API_BASE_URL}/skins${waitMs ? `?waitMs=${waitMs}` : ""}`
    : `${MINESKIN_API_BASE_URL}/queue`;
  let data = await readMineSkinResponse(
    await fetch(enqueueUrl, {
      method: "POST",
      headers,
      body: formData,
    }),
  );

  for (;;) {
    if (data.job?.status === "failed") {
      throw new Error("Job failed to complete");
    }
    if (data.skin) {
      return { ...data, skin: data.skin };
    }
    if (!data.job) {
      throw new Error("Job not found in response");
    }
    if (data.job.status === "completed") {
      throw new Error("Skin not found in completed job response");
    }

    const jobUrl = useCapeProxy
      ? `${AXOLOTL_API_BASE_URL}/jobs/${data.job.id}`
      : `${MINESKIN_API_BASE_URL}/queue/${data.job.id}`;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs ?? 1000));
    data = await readMineSkinResponse(await fetch(jobUrl, { headers }));
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
  const response = await fetch(`${MINESKIN_API_BASE_URL}/me`, {
    headers: createMineSkinHeaders(apiKey),
  });

  const data = (await response.json()) as MineSkinMeResponse;

  if (!response.ok || data.success === false) {
    throw new Error(getMineSkinError(data.errors));
  }

  return Boolean(data.grants?.capes);
}

export async function fetchMineSkinSupportedCapes(
  apiKey?: string,
): Promise<MineSkinCape[]> {
  const response = await fetch(`${MINESKIN_API_BASE_URL}/capes`, {
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
