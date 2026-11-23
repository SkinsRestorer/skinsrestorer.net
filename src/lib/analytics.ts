import { posthog } from "posthog-js";
import { redactEditorParams } from "./analytics-redact";

const apiKey = import.meta.env["VITE_POSTHOG_KEY"];
const ahrefsKey = "aer4SuKmVEAedLgr3jfsYA";

/** Add the Ahrefs Analytics script once. Call it only after consent. */
function loadAhrefs() {
  if (document.querySelector("script[data-ahrefs-analytics]")) return;
  const script = document.createElement("script");
  script.src = "https://analytics.ahrefs.com/analytics.js";
  script.dataset["key"] = ahrefsKey;
  script.dataset["ahrefsAnalytics"] = "";
  script.async = true;
  document.head.insertAdjacentElement("beforeend", script);
}

/** Start PostHog capture and Ahrefs Analytics after the visitor allows them. */
export function allowAnalytics() {
  posthog.opt_in_capturing();
  loadAhrefs();
}

/**
 * Stop PostHog capture and delete its cookie and storage. An Ahrefs script
 * that already loaded stops on the next page load, because it does not
 * load again.
 */
export function declineAnalytics() {
  posthog.opt_out_capturing();
}

if (typeof window !== "undefined" && apiKey) {
  posthog.init(apiKey, {
    api_host: "https://t.skinsrestorer.net",
    ui_host: "https://eu.posthog.com",
    defaults: "2025-05-24",
    // Send nothing and store nothing until the visitor allows analytics.
    // Declining keeps it that way; there is no cookieless fallback.
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
    session_recording: { sampleRate: 0.1 },
    // Record which element and phase made INP or CLS slow.
    capture_performance: { web_vitals_attribution: true },
    debug: import.meta.env.DEV,
    // Texture links identify a skin; keep them out of events and replays.
    before_send: (event) => event && redactEditorParams(event),
  });
  if (posthog.get_explicit_consent_status() === "granted") loadAhrefs();
}
