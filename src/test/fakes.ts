/**
 * Fakes shared by unit tests. Only test files import this module, so it never
 * reaches the app bundle.
 */
import type { KeyValueStorage } from "@/lib/skin-draft";

/** Web storage kept in a map, which tests can read and change directly. */
export function memoryStorage(
  initial: Record<string, string> = {},
): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function blocked(): never {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

/** Web storage that the browser blocks, as in some private windows. */
export const blockedStorage: KeyValueStorage = {
  getItem: blocked,
  setItem: blocked,
  removeItem: blocked,
};

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/**
 * Replace `globalThis.fetch` with `respond` and record each request. Call
 * `restore` when the test ends, for example in `afterEach` or `finally`.
 */
export function mockFetch(
  respond: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : input.toString();
      calls.push({ url, init });
      return Promise.resolve().then(() => respond(url, init));
    },
    { preconnect: original.preconnect },
  );
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
