import { useSyncExternalStore } from "react";
import { analytics } from "../analytics";
import type { ConsentChoice } from "../analytics-consent";

const reopenListeners = new Set<(opener: HTMLElement | null) => void>();

/** Show the consent banner again so visitors can change their choice. */
export function openCookieSettings(opener: HTMLElement | null) {
  for (const listener of reopenListeners) listener(opener);
}

/** Call `listener` whenever a control asks to reopen the consent banner. */
export function onCookieSettingsOpen(
  listener: (opener: HTMLElement | null) => void,
) {
  reopenListeners.add(listener);
  return () => {
    reopenListeners.delete(listener);
  };
}

/** The stored analytics choice. Undefined during server rendering. */
export function useAnalyticsConsent(): ConsentChoice | undefined {
  return useSyncExternalStore<ConsentChoice | undefined>(
    analytics.subscribe,
    analytics.getConsent,
    () => undefined,
  );
}
