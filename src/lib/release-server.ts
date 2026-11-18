import { createServerFn } from "@tanstack/react-start";

export const getLatestRelease = createServerFn({ method: "GET" }).handler(
  async () => {
    const releases = await import("./releases");
    return releases.getLatestRelease();
  },
);
