/**
 * Headers for every response. public/_headers repeats them for prerendered
 * assets, which Cloudflare serves without running the worker.
 */

const posthogHost = "https://t.skinsrestorer.net";
// Browsers send violation reports to the site, which removes page addresses'
// query and fragment before it forwards them (src/routes/api/csp-report.ts).
// vite.config.ts imports this file in Node, so it cannot import that route.
export const cspReportPath = "/api/csp-report";

const cspDirectives = {
  "default-src": ["'self'"],
  // Prerendered pages carry per-page hydration scripts, and Cloudflare injects
  // its own inline challenge loader, so neither nonces nor hashes can work.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    posthogHost,
    "https://analytics.ahrefs.com",
    // Cloudflare injects its Web Analytics beacon into production pages.
    "https://static.cloudflareinsights.com",
  ],
  // Server-rendered style attributes, theme and toast styles.
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://textures.minecraft.net",
    "https://cool-skins.skinsrestorer.net",
    // Team avatars on the home page redirect to avatars.githubusercontent.com.
    "https://github.com",
    "https://avatars.githubusercontent.com",
  ],
  "font-src": ["'self'"],
  "connect-src": [
    "'self'",
    posthogHost,
    "https://eu.posthog.com",
    "https://analytics.ahrefs.com",
    "https://cloudflareinsights.com",
    "https://api.mineskin.org",
    "https://axolotl.skinsrestorer.net",
    "https://textures.minecraft.net",
    "https://cool-skins.skinsrestorer.net",
  ],
  // Donation widgets on the pricing page.
  "frame-src": ["https://ko-fi.com", "https://nowpayments.io"],
  // PostHog session replay compresses canvas frames in a blob worker.
  "worker-src": ["blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "report-uri": [cspReportPath],
  "report-to": ["csp"],
};

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([name, sources]) => `${name} ${sources.join(" ")}`)
  .join("; ");

// Turn off device features the site never uses. Clipboard and payment stay
// allowed for copy buttons and the donation widgets.
const permissionsPolicy = [
  "camera",
  "microphone",
  "geolocation",
  "usb",
  "serial",
  "hid",
  "midi",
  "browsing-topics",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

export const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-XSS-Protection": "0",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": permissionsPolicy,
  // Donation checkouts open PayPal and Stripe in popups that need the opener.
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Enforced; violations are still reported.
  "Content-Security-Policy": contentSecurityPolicy,
  "Reporting-Endpoints": `csp="${cspReportPath}"`,
};
