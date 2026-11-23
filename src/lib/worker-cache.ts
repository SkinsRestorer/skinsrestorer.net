/** The part of the Cache API that the site uses. */
export interface SharedCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

function isSharedCache(value: unknown): value is SharedCache {
  return (
    typeof value === "object" &&
    value !== null &&
    "match" in value &&
    typeof value.match === "function" &&
    "put" in value &&
    typeof value.put === "function"
  );
}

/**
 * The Workers cache that all isolates in a data center share. It is missing
 * outside the Workers runtime, such as in tests.
 */
export function workerCache(): SharedCache | undefined {
  return typeof caches !== "undefined" &&
    "default" in caches &&
    isSharedCache(caches.default)
    ? caches.default
    : undefined;
}
