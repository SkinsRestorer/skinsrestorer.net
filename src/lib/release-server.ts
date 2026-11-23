import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
// The Start compiler replaces the handler with an RPC stub in the client build
// and drops imports that only the handler used, so this stays on the server.
import { getLatestRelease as readLatestRelease } from "./releases";

export const getLatestRelease = createServerFn({ method: "GET" }).handler(
  () => {
    // The server copy can already be up to 120 seconds old, so a
    // short browser cache keeps the total age near that limit.
    setResponseHeader("Cache-Control", "public, max-age=15");
    return readLatestRelease();
  },
);
