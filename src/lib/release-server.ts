import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
// The Start compiler replaces the handler with an RPC stub in the client build
// and drops imports that only the handler used, so this stays on the server.
import {
  getLatestRelease as readLatestRelease,
  RELEASE_TTL_SECONDS,
} from "./releases";

export const getLatestRelease = createServerFn({ method: "GET" }).handler(
  () => {
    // Browsers reuse the answer for as long as the server caches it.
    setResponseHeader(
      "Cache-Control",
      `public, max-age=${RELEASE_TTL_SECONDS}, stale-while-revalidate=60`,
    );
    return readLatestRelease();
  },
);
