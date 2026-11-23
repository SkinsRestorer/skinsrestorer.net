// The site's own PostHog EU Cloud proxy. The browser sends events through it
// and the worker forwards CSP reports to it. public/_headers repeats it in the
// Content Security Policy, so it is a constant and not a build variable.
export const POSTHOG_HOST = "https://t.skinsrestorer.net";
// The PostHog app, which the PostHog toolbar contacts for site staff.
export const POSTHOG_UI_HOST = "https://eu.posthog.com";
