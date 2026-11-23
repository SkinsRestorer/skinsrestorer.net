import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          MAX_CSP_REPORT_BYTES,
          forwardCspReport,
          isCspReportContentType,
          readBoundedText,
          sanitizeCspReport,
        } = await import("@/lib/csp-report");
        const { runHttpEffect } = await import("@/lib/effect-http");
        const contentType = request.headers.get("Content-Type");
        if (!contentType || !isCspReportContentType(contentType))
          return new Response(null, { status: 415 });
        const body = await readBoundedText(request.body, MAX_CSP_REPORT_BYTES);
        if (body === undefined) return new Response(null, { status: 413 });
        const report = sanitizeCspReport(body);
        if (!report) return new Response(null, { status: 400 });
        // The visitor's request headers, such as the IP address, stay here.
        await runHttpEffect(forwardCspReport(report, contentType));
        return new Response(null, { status: 204 });
      },
    },
  },
});
