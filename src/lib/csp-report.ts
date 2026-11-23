import { Effect } from "effect";
import { readHttpBytes } from "./effect-http";

// The public project token that the browser bundle also sends events with.
// Vite inlines it at build time, in the worker as in the browser.
const posthogToken: string | undefined = import.meta.env["VITE_POSTHOG_KEY"];

/** Browsers send a few kilobytes per report; anything larger is not a report. */
export const MAX_CSP_REPORT_BYTES = 64 * 1024;

const reportContentTypes = new Set([
  "application/csp-report",
  "application/reports+json",
]);

// Script samples copy page content into the report.
const droppedFields = new Set(["script-sample", "sample"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Keep the origin and path of a URL; drop its query, fragment, and user info. */
function stripUrl(value: string): string {
  if (!/^[a-z][a-z\d+.-]*:\/\//iu.test(value)) return value;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
}

function sanitize(value: unknown): unknown {
  if (typeof value === "string") return stripUrl(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (!droppedFields.has(key)) result[key] = sanitize(field);
  }
  return result;
}

/**
 * Keep only CSP violation reports, so the endpoint cannot relay other JSON
 * to PostHog under the site's token.
 */
function cspReports(report: unknown): unknown {
  if (Array.isArray(report)) {
    const violations = report.filter(
      (item: unknown) =>
        isRecord(item) &&
        item["type"] === "csp-violation" &&
        isRecord(item["body"]),
    );
    return violations.length > 0 ? violations : undefined;
  }
  if (isRecord(report) && isRecord(report["csp-report"]))
    return { "csp-report": report["csp-report"] };
  return undefined;
}

/**
 * Remove query strings and fragments from every URL in a CSP report, in both
 * the `report-uri` and the Reporting API format, and drop script samples.
 * Page addresses can carry texture hashes.
 * Returns undefined when the body is not a JSON CSP report.
 */
export function sanitizeCspReport(body: string): string | undefined {
  try {
    const report = cspReports(JSON.parse(body));
    return report === undefined ? undefined : JSON.stringify(sanitize(report));
  } catch {
    return undefined;
  }
}

/**
 * Read a request body as text, up to `maxBytes`. Returns undefined when the
 * body is longer, without reading the rest. A chunked request has no
 * Content-Length, so the length header alone cannot limit it.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | undefined> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    text += decoder.decode(value, { stream: true });
  }
}

export function isCspReportContentType(contentType: string | null) {
  const type = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return reportContentTypes.has(type);
}

/**
 * Forward a sanitized report to PostHog. Failures are dropped, not retried.
 * Without a project token, the report is dropped.
 */
export function forwardCspReport(body: string, contentType: string) {
  if (!posthogToken) return Effect.void;
  return readHttpBytes(
    `https://t.skinsrestorer.net/report/?token=${encodeURIComponent(posthogToken)}`,
    { method: "POST", headers: { "Content-Type": contentType }, body },
    { timeoutMs: 5000, maxBytes: 16 * 1024 },
  ).pipe(Effect.asVoid, Effect.ignore);
}
