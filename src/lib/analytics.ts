import type { PostHog, PostHogConfig } from "posthog-js";
import { redactEditorParams } from "./analytics-redact";
import {
  CONSENT_STORAGE_KEY,
  type ConsentChoice,
  type ConsentStorage,
  readConsent,
  writeConsent,
} from "./analytics-consent";
import { splitLocalePath } from "./i18n";
import { POSTHOG_HOST, POSTHOG_UI_HOST } from "./posthog-hosts";

interface PostHogClient extends Pick<
  PostHog,
  "capture" | "opt_in_capturing" | "opt_out_capturing" | "stopSessionRecording"
> {
  init(token: string, config: Partial<PostHogConfig>): unknown;
}

interface AnalyticsOptions {
  /** The PostHog project token. Without it, the site sends nothing. */
  token: string | undefined;
  storage: () => ConsentStorage | undefined;
  /** Import PostHog. The site calls it only after the visitor allows analytics. */
  loadPostHog: () => Promise<PostHogClient>;
  /** Start the analytics that need no PostHog, such as Ahrefs. */
  onAllowed?: () => void;
  /** Stop the analytics that need no PostHog. */
  onDeclined?: () => void;
}

function postHogConfig(): Partial<PostHogConfig> {
  return {
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    defaults: "2025-05-24",
    // PostHog reads and writes the choice under the site's own key.
    consent_persistence_name: CONSENT_STORAGE_KEY,
    // PostHog starts only after a stored "allow". If that choice cannot be
    // read, for example because storage is blocked, PostHog stays off.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    capture_exceptions: true,
    // Keep navigation and actions without recording clicks on arbitrary content.
    autocapture: {
      dom_event_allowlist: ["click"],
      css_selector_allowlist: [
        "a[href]",
        "button",
        "input[type=submit]",
        "[role=button]",
      ],
    },
    session_recording: {
      sampleRate: 0.1,
      // Replay snapshots reach before_send uncompressed, so the redaction
      // below also covers texture URLs in recorded pages. The request that
      // carries them is still compressed.
      compress_events: false,
    },
    // Record which element and phase made INP or CLS slow.
    capture_performance: { web_vitals_attribution: true },
    debug: import.meta.env.DEV,
    // Texture links identify a skin; keep them out of events and replays.
    before_send: (event) => event && redactEditorParams(event),
  };
}

/** Remove the PostHog cookie and storage entries that a previous visit left. */
function clearPostHogStorage(token: string) {
  const name = `ph_${token}_posthog`;
  try {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  } catch {
    // Nothing to remove when storage is unavailable.
  }
  // PostHog sets the cookie on the parent domain, so remove both variants.
  const expired = `${name}=; Max-Age=0; Path=/`;
  // oxlint-disable-next-line unicorn/no-document-cookie -- Remove a cookie that PostHog set.
  document.cookie = expired;
  const parent = location.hostname.split(".").slice(-2).join(".");
  // oxlint-disable-next-line unicorn/no-document-cookie -- Remove a cookie that PostHog set.
  document.cookie = `${expired}; Domain=.${parent}`;
}

/**
 * Hold the analytics choice and start or stop PostHog to match it. PostHog
 * is imported only after the visitor allows analytics, so before a choice
 * and after "Decline" the browser does not load or contact PostHog.
 */
export function createAnalytics(options: AnalyticsOptions) {
  const listeners = new Set<() => void>();
  let consent: ConsentChoice | undefined;
  let client: Promise<PostHogClient | undefined> | undefined;
  let started: PostHogClient | undefined;

  const getConsent = () => (consent ??= readConsent(options.storage()));

  const setConsent = (choice: Exclude<ConsentChoice, "pending">) => {
    writeConsent(options.storage(), choice);
    consent = choice;
    for (const listener of listeners) listener();
  };

  /** Stop PostHog capture and replay, delete its storage, and stop Ahrefs. */
  const stopAnalytics = () => {
    if (started) {
      started.opt_out_capturing();
      // Opting out drops new snapshots; this also stops the recorder.
      started.stopSessionRecording();
    } else if (options.token && typeof document !== "undefined")
      clearPostHogStorage(options.token);
    options.onDeclined?.();
  };

  /** Import and initialize PostHog once, unless consent changed meanwhile. */
  const startPostHog = () => {
    const token = options.token;
    if (!token) return Promise.resolve(undefined);
    client ??= options.loadPostHog().then(
      (posthog) => {
        if (getConsent() !== "granted") {
          client = undefined;
          return undefined;
        }
        if (!started) {
          posthog.init(token, postHogConfig());
          started = posthog;
        }
        return posthog;
      },
      () => {
        // Try again on the next page view or choice.
        client = undefined;
        return undefined;
      },
    );
    return client;
  };

  return {
    getConsent,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Start analytics on page load when the visitor allowed it before. */
    startIfAllowed: () => {
      if (getConsent() !== "granted") return;
      void startPostHog();
      options.onAllowed?.();
    },
    /** Start PostHog capture and Ahrefs Analytics. */
    allow: () => {
      setConsent("granted");
      // PostHog already ran on this page and was stopped: start it again.
      // Both paths record the choice as an $opt_in event.
      if (started) started.opt_in_capturing();
      else void startPostHog().then((posthog) => posthog?.capture("$opt_in"));
      options.onAllowed?.();
    },
    /**
     * Stop PostHog capture, including session replay, delete its cookie and
     * storage, and stop Ahrefs.
     */
    decline: () => {
      setConsent("denied");
      stopAnalytics();
    },
    /**
     * Apply a choice that another tab stored. Without this, a tab opened
     * before the visitor declined elsewhere keeps PostHog running and writes
     * its cookie again.
     */
    syncStoredConsent: () => {
      const previous = consent;
      consent = readConsent(options.storage());
      if (consent === previous) return;
      for (const listener of listeners) listener();
      if (consent === "granted") {
        // The other tab already recorded the $opt_in event.
        if (started) started.opt_in_capturing({ captureEventName: false });
        else void startPostHog();
        options.onAllowed?.();
      } else if (consent === "denied") stopAnalytics();
    },
    /**
     * Send an event when the visitor allowed analytics. Resolves to whether
     * PostHog accepted it.
     */
    capture: async (event: string, properties?: Record<string, unknown>) => {
      if (getConsent() !== "granted") return false;
      const posthog = await startPostHog();
      return posthog?.capture(event, properties) !== undefined;
    },
  };
}

const ahrefsKey = "aer4SuKmVEAedLgr3jfsYA";
// These pages carry texture hashes in their address, and Ahrefs reports the
// full page address when a form on them is submitted.
const studioPaths = new Set(["/studio", "/upload", "/generator"]);
let ahrefsScript: HTMLScriptElement | undefined;
let trackingLocation = false;

function isStudioPage() {
  return studioPaths.has(splitLocalePath(location.pathname).path);
}

/**
 * Keep Ahrefs Analytics off the Studio pages and its page address redacted.
 * Ahrefs sends a page view after each pushState and popstate, using
 * data-page-location when it differs from the last address it sent.
 */
function syncAhrefs() {
  if (ahrefsScript) {
    // A loaded script cannot be stopped, so load a Studio page again without
    // it. The address that Ahrefs reads stays unchanged, so it sends no page
    // view for the Studio page.
    if (isStudioPage()) location.reload();
    else
      ahrefsScript.dataset["pageLocation"] = redactEditorParams(location.href);
    return;
  }
  // Ahrefs also sends the referrer, which can be a Studio address.
  const referrer = document.referrer;
  if (
    isStudioPage() ||
    analytics.getConsent() !== "granted" ||
    redactEditorParams(referrer) !== referrer
  )
    return;
  const script = document.createElement("script");
  script.src = "https://analytics.ahrefs.com/analytics.js";
  script.dataset["key"] = ahrefsKey;
  script.dataset["pageLocation"] = redactEditorParams(location.href);
  script.async = true;
  ahrefsScript = script;
  document.head.insertAdjacentElement("beforeend", script);
}

/**
 * Start Ahrefs after consent. The history wrappers and the popstate
 * listener are added before the script loads, so they run before the ones
 * that Ahrefs adds and update the address before Ahrefs reads it.
 */
function enableAhrefs() {
  if (!trackingLocation) {
    trackingLocation = true;
    for (const method of ["pushState", "replaceState"] as const) {
      const original = history[method];
      history[method] = (...args: Parameters<History["pushState"]>) => {
        original.apply(history, args);
        syncAhrefs();
      };
    }
    addEventListener("popstate", () => {
      syncAhrefs();
    });
  }
  syncAhrefs();
}

const browser = typeof window !== "undefined";

export const analytics = createAnalytics({
  token: import.meta.env["VITE_POSTHOG_KEY"],
  storage: () => {
    try {
      return browser ? localStorage : undefined;
    } catch {
      return undefined;
    }
  },
  loadPostHog: () => import("posthog-js").then((module) => module.posthog),
  onAllowed: enableAhrefs,
  // A loaded Ahrefs script cannot be stopped, so load the page again without it.
  onDeclined: () => {
    if (ahrefsScript) location.reload();
  },
});

if (browser) {
  // Another tab changed the choice, or the visitor cleared site data.
  window.addEventListener("storage", (event) => {
    if (event.key === CONSENT_STORAGE_KEY || event.key === null)
      analytics.syncStoredConsent();
  });
  analytics.startIfAllowed();
}
