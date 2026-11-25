import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Effect, Option } from "effect";
import { AsyncResult, Atom } from "effect/reactivity";
import { useState } from "react";
import { toast } from "sonner";
import { abortable } from "../latest-effect";

import {
  fetchCapeSupport,
  fetchMineSkinSupportedCapes,
  type MineSkinCape,
} from "@/lib/mineskin";
import { useNotificationT } from "@/lib/i18n-react";

import type { Translator } from "@/lib/messages";
import type { CapeStatus } from "@/lib/studio-options";

/**
 * The public cape list. Every picker shares it while one is open, and the
 * server renders it as loading.
 */
const publicCapesAtom = Atom.make(
  abortable((signal) => fetchMineSkinSupportedCapes(undefined, signal)),
).pipe(Atom.withServerValueInitial);

type KeyCheck =
  | { readonly status: "missing" | "denied" }
  | { readonly status: "granted"; readonly capes: MineSkinCape[] };

/** One key check at a time; a newer check or a reset interrupts it. */
const keyCheckAtom = (t: Translator) =>
  Atom.setIdleTTL(
    Atom.fn((apiKey: string) =>
      // The key field shows both problems as its own error.
      apiKey
        ? abortable((signal) => fetchCapeSupport(apiKey, signal)).pipe(
            Effect.map(({ hasCapeGrant, capes }): KeyCheck => {
              if (!hasCapeGrant) return { status: "denied" };
              // The key field says when the key has no capes.
              if (capes.length > 0)
                toast.success(t("capes.capeSupportEnabledApiKey"));
              return { status: "granted", capes };
            }),
            Effect.tapError((error) =>
              Effect.sync(() => {
                toast.error(
                  error instanceof Error
                    ? t.error(error)
                    : t("capes.failedVerifyCapeSupport"),
                );
              }),
            ),
          )
        : Effect.succeed<KeyCheck>({ status: "missing" }),
    ),
    0,
  );

/** A failed check already showed its toast and leaves the key unchecked. */
function keyStatusOf(result: AsyncResult.AsyncResult<KeyCheck, unknown>) {
  if (result.waiting) return "loading";
  return AsyncResult.isSuccess(result) ? result.value.status : "idle";
}

/**
 * The capes MineSkin offers and whether the entered API key may apply them.
 * The key itself belongs to the form; this hook only receives it for an
 * explicit check and never keeps it.
 */
export function useCapeAccess(options: { readonly keyRequired: boolean }) {
  const t = useNotificationT();
  // oxlint-disable-next-line react/hook-use-state -- Each form owns one check and never replaces it.
  const [keyCheck] = useState(() => keyCheckAtom(t));
  const [check, setCheck] = useAtom(keyCheck);
  const publicCapes = useAtomValue(publicCapesAtom);
  const retryList = useAtomRefresh(publicCapesAtom);

  const keyStatus: CapeStatus = keyStatusOf(check);
  /** The capes of the last key that passed its check. */
  const checked = AsyncResult.value(check);
  const keyCapes =
    Option.isSome(checked) && checked.value.status === "granted"
      ? checked.value.capes
      : undefined;

  // Axolotl applies capes without a key, from the public list. Official uses
  // the checked key's capes once the key passes.
  const status: CapeStatus = options.keyRequired ? keyStatus : "granted";
  const fromKey = options.keyRequired ? keyCapes : undefined;
  const supportedCapes = fromKey ?? AsyncResult.getOrElse(publicCapes, noCapes);
  /** The public cape list: loading shows placeholders, failed offers a retry. */
  let listStatus: "loading" | "ready" | "failed" = "ready";
  if (!fromKey) {
    if (publicCapes.waiting || AsyncResult.isInitial(publicCapes))
      listStatus = "loading";
    else if (AsyncResult.isFailure(publicCapes)) listStatus = "failed";
  }
  const capeOptionsDisabled =
    status !== "granted" || supportedCapes.length === 0;

  return {
    status,
    /** Whether the entered key passed its check, whatever the method. */
    keyGranted: keyStatus === "granted",
    capeOptionsDisabled,
    supportedCapes,
    /** Whether the cape list is still loading or could not be loaded. */
    listStatus,
    /** Load the public cape list again after a failure. */
    retryList,
    /** The key changed: its earlier check and capes no longer apply. */
    reset: () => {
      setCheck(Atom.Reset);
    },
    /** Check the capes grant of this key, only when the user asks. */
    verify: (apiKey: string) => {
      setCheck(apiKey);
    },
  };
}

const noCapes = (): MineSkinCape[] => [];
