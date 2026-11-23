/** The visitor's analytics choice. `pending` means no choice yet. */
export type ConsentChoice = "granted" | "denied" | "pending";

/**
 * Local storage key for the analytics choice. PostHog reads and writes the
 * same key (its `consent_persistence_name`), so both always agree.
 */
export const CONSENT_STORAGE_KEY = "skinsrestorer:analytics-consent";

/** Where older versions of the site let PostHog store the choice. */
export function legacyConsentKey(token: string) {
  return `__ph_opt_in_out_${token}`;
}

export type ConsentStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

// PostHog stores the choice as JSON, so it writes "1" and "0". Accept the
// same yes and no values that PostHog accepts.
const grantedValues = new Set(["1", "true", "yes"]);
const deniedValues = new Set(["0", "false", "no"]);

export function parseConsent(value: string | null | undefined): ConsentChoice {
  if (value == null) return "pending";
  if (grantedValues.has(value)) return "granted";
  if (deniedValues.has(value)) return "denied";
  return "pending";
}

/**
 * Read the stored choice. A choice that an older version of the site stored
 * under the PostHog key moves to {@link CONSENT_STORAGE_KEY}. Unavailable
 * storage counts as no choice.
 */
export function readConsent(
  storage: ConsentStorage | undefined,
  token: string | undefined,
): ConsentChoice {
  if (!storage) return "pending";
  try {
    const stored = parseConsent(storage.getItem(CONSENT_STORAGE_KEY));
    if (stored !== "pending" || !token) return stored;
    const legacy = parseConsent(storage.getItem(legacyConsentKey(token)));
    if (legacy !== "pending") {
      writeConsent(storage, legacy);
      storage.removeItem(legacyConsentKey(token));
    }
    return legacy;
  } catch {
    return "pending";
  }
}

/** Store a choice in the format PostHog reads. */
export function writeConsent(
  storage: ConsentStorage | undefined,
  choice: Exclude<ConsentChoice, "pending">,
) {
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, choice === "granted" ? "1" : "0");
  } catch {
    // The choice still applies to this page view.
  }
}

/**
 * Decide whether the consent banner shows and whether it can close without
 * a choice. `stored` is undefined before hydration, when the server cannot
 * know the choice. A first-time visitor must pick an option; a visitor who
 * reopened the banner can close it and keep the current choice.
 */
export function consentBannerState(
  stored: ConsentChoice | undefined,
  reopened: boolean,
) {
  if (stored === undefined && !reopened)
    return { visible: false, dismissible: false };
  const choiceMade = stored === "granted" || stored === "denied";
  return {
    visible: reopened || !choiceMade,
    dismissible: reopened && choiceMade,
  };
}
