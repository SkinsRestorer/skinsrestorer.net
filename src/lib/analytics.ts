import posthog from "posthog-js";
import { redactEditorParams } from "./analytics-redact";

const apiKey = import.meta.env.VITE_POSTHOG_KEY;

if (typeof window !== "undefined" && apiKey) {
  posthog.init(apiKey, {
    api_host: "https://t.skinsrestorer.net",
    ui_host: "https://eu.posthog.com",
    defaults: "2025-05-24",
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
    debug: import.meta.env.DEV,
    cookieless_mode: "on_reject",
    // Texture links identify a skin; keep them out of events and replays.
    before_send: (event) => event && redactEditorParams(event),
  });
}
