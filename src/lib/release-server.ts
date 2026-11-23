import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

export const getLatestRelease = createServerFn({ method: "GET" }).handler(
  async () => {
    // Browsers reuse the answer for the same 120 seconds as the server caches.
    setResponseHeader(
      "Cache-Control",
      "public, max-age=120, stale-while-revalidate=60",
    );
    const releases = await import("./releases");
    return releases.getLatestRelease();
  },
);
