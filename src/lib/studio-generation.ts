import { LatestTask } from "./latest-task";
import type {
  MineSkinCompletedResponse,
  MineSkinUploadOptions,
} from "./mineskin";
import { sameGenerationInput, type GenerationInput } from "./skin-selection";
import {
  generatedCommand,
  suggestSkinName,
  textureUrlFromValue,
  type StudioPurpose,
} from "./studio";

export interface GenerationResult {
  readonly command: string;
  /** The server URL in the command: a MineSkin URL or an Axolotl value. */
  readonly url: string;
  /** The stable textures.minecraft.net URL, when the response has one. */
  readonly textureUrl: string | null;
}

export type GenerationState =
  | { readonly status: "idle" }
  | { readonly status: "pending"; readonly input: GenerationInput }
  | {
      readonly status: "done";
      readonly input: GenerationInput;
      readonly result: GenerationResult;
    }
  | {
      readonly status: "failed";
      readonly input: GenerationInput;
      readonly message: string;
    };

export type Upload = (
  options: MineSkinUploadOptions,
  signal: AbortSignal,
) => Promise<MineSkinCompletedResponse>;

/** Build the command and links from a completed MineSkin response. */
export function generationResult(
  input: GenerationInput,
  response: MineSkinCompletedResponse,
): GenerationResult {
  const { skin } = response;
  const result =
    "uuid" in skin
      ? {
          url: skin.url || `https://minesk.in/${skin.uuid}`,
          name: skin.name || skin.uuid,
          textureUrl: textureUrlFromValue(skin.texture.data.value),
        }
      : {
          url: skin.url,
          name: suggestSkinName(input.file.name) || "custom_skin",
          textureUrl: null,
        };
  return {
    url: result.url,
    command: generatedCommand(
      input.purpose as StudioPurpose,
      { url: result.url, name: input.name || result.name },
      input.variant,
    ),
    textureUrl: result.textureUrl,
  };
}

/**
 * One generation at a time. A new request or `cancel` drops the previous
 * one, and a failed upload is never sent again on its own. The state keeps
 * its input, so a view shows it only for the exact same choices.
 */
export class StudioGeneration {
  private state: GenerationState = { status: "idle" };
  private readonly listeners = new Set<() => void>();
  private readonly task = new LatestTask();

  constructor(private readonly upload: Upload) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  private set(state: GenerationState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  /** The state, only when it belongs to these exact choices. */
  for(input: GenerationInput | null): GenerationState {
    const state = this.state;
    if (state.status === "idle" || !input) return { status: "idle" };
    return sameGenerationInput(state.input, input) ? state : { status: "idle" };
  }

  generate(input: GenerationInput, options: MineSkinUploadOptions) {
    this.set({ status: "pending", input });
    return this.task.run(
      (signal) => this.upload(options, signal),
      (response) =>
        this.set({
          status: "done",
          input,
          result: generationResult(input, response),
        }),
      (cause) =>
        this.set({
          status: "failed",
          input,
          message:
            cause && typeof cause === "object" && "message" in cause
              ? String(cause.message)
              : "Something went wrong.",
        }),
    );
  }

  /** Stop waiting for the current upload. Its late result is dropped. */
  cancel() {
    this.task.cancel();
    if (this.state.status === "pending") this.set({ status: "idle" });
  }
}
