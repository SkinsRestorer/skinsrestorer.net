import { createServerFn } from "@tanstack/react-start";

export const getLatestRelease = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getLatestRelease } = await import("./releases");
    return getLatestRelease();
  },
);
