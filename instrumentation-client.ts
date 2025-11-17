import posthog from "posthog-js";

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (typeof window !== "undefined" && apiKey) {
  posthog.init(apiKey, {
    api_host: "/RELAY-KAWD",
    ui_host: "https://eu.posthog.com",
    defaults: "2025-05-24",
    capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
    debug: process.env.NODE_ENV === "development",
    cookieless_mode: "on_reject",
  });
}
