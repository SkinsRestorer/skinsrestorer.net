import type { MessageKey } from "@/lib/messages";
import { isValidSkinName } from "./skin";
import type { StudioPurpose } from "./studio";

export const NO_CAPE_VALUE = "__no_cape__" as const;

export type UploadMethod = "axolotl" | "mineskin";

export type CapeStatus = "idle" | "loading" | "granted" | "denied";

/**
 * The options form of the Studio. The skin file and model live in the
 * selection store, so the form never holds a copy of them.
 */
export interface StudioOptions {
  /** The user's choice; an entry URL or intent can fix it instead. */
  readonly purpose: StudioPurpose;
  readonly method: UploadMethod;
  readonly capeUuid: string;
  readonly customName: string;
  /** Kept in form memory only. */
  readonly apiKey: string;
}

export const defaultStudioOptions: StudioOptions = {
  purpose: "skin-url",
  method: "axolotl",
  capeUuid: NO_CAPE_VALUE,
  customName: "",
  apiKey: "",
};

/** The values that generation uses, after trimming. */
export interface NormalizedStudioOptions {
  readonly purpose: StudioPurpose;
  readonly method: UploadMethod;
  readonly capeUuid: string;
  /** Empty means the original name: no name is sent. */
  readonly name: string;
  readonly apiKey: string;
}

/** Trim at the submit boundary. Validation never changes the form values. */
export function normalizeStudioOptions(
  options: StudioOptions,
  purpose: StudioPurpose,
): NormalizedStudioOptions {
  return {
    purpose,
    method: options.method,
    capeUuid: options.capeUuid,
    name: purpose === "createcustom" ? options.customName.trim() : "",
    apiKey: options.apiKey.trim(),
  };
}

export type StudioOptionErrors = Partial<
  Record<"customName" | "capeUuid", MessageKey>
>;

/**
 * Field and cross-field checks. The messages are stable keys that the view
 * translates. The custom name is optional and only checked for custom skins.
 */
export function studioOptionErrors(
  options: StudioOptions,
  context: { readonly purpose: StudioPurpose; readonly capeStatus: CapeStatus },
): StudioOptionErrors {
  const errors: { -readonly [K in keyof StudioOptionErrors]: MessageKey } = {};
  const { name } = normalizeStudioOptions(options, context.purpose);
  if (name && !isValidSkinName(name))
    errors.customName = "studio.useLowercaseLettersNumbersUnderscores";
  if (
    options.method === "mineskin" &&
    options.capeUuid !== NO_CAPE_VALUE &&
    context.capeStatus !== "granted"
  )
    errors.capeUuid = "studio.enterVerifyApiKeyBeforeSelectingCape";
  return errors;
}
