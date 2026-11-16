/**
 * Headers for every response. public/_headers repeats them for prerendered
 * assets, which Cloudflare serves without running the worker.
 */

const posthogHost = "https://t.skinsrestorer.net";
// The public project token, the same one the browser bundle sends events with.
const posthogToken = "phc_PiA4lEVOouI4hJ8fsh6wNy1GB3HWe8VcLcjdluef34m";
export const cspReportUrl = `${posthogHost}/report/?token=${posthogToken}`;

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
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
  "report-uri": [cspReportUrl],
  "report-to": ["posthog"],
};

export const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([name, sources]) => `${name} ${sources.join(" ")}`)
  .join("; ");

export const securityHeaders = {
  "X-DNS-Prefetch-Control": "on",
  "X-XSS-Protection": "0",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  // Report-only until production reports show no legitimate violations.
  "Content-Security-Policy-Report-Only": contentSecurityPolicy,
  "Reporting-Endpoints": `posthog="${cspReportUrl}"`,
};
