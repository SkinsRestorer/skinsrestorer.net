import posthog from "posthog-js";

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

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
    debug: process.env.NODE_ENV === "development",
    cookieless_mode: "on_reject",
  });
}
