import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSENT_STORAGE_KEY,
  consentBannerState,
  legacyConsentKey,
  parseConsent,
  readConsent,
  writeConsent,
} from "./analytics-consent";

function memoryStorage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

test("stored values follow the yes and no values PostHog writes", () => {
  assert.equal(parseConsent("1"), "granted");
  assert.equal(parseConsent("true"), "granted");
  assert.equal(parseConsent("0"), "denied");
  assert.equal(parseConsent("no"), "denied");
  assert.equal(parseConsent(null), "pending");
  assert.equal(parseConsent("maybe"), "pending");
});

test("a choice stored by PostHog under the old key moves to the site key", () => {
  const storage = memoryStorage({ [legacyConsentKey("phc_x")]: "1" });
  assert.equal(readConsent(storage, "phc_x"), "granted");
  assert.deepEqual(Object.fromEntries(storage.items), {
    [CONSENT_STORAGE_KEY]: "1",
  });
});

test("the site key wins over a leftover PostHog key", () => {
  const storage = memoryStorage({
    [CONSENT_STORAGE_KEY]: "0",
    [legacyConsentKey("phc_x")]: "1",
  });
  assert.equal(readConsent(storage, "phc_x"), "denied");
});

test("blocked storage counts as no choice and writes do not throw", () => {
  const blocked = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
    removeItem: () => {},
  };
  assert.equal(readConsent(blocked, "phc_x"), "pending");
  assert.equal(readConsent(undefined, "phc_x"), "pending");
  writeConsent(blocked, "granted");
});

test("a choice is stored in the format PostHog reads", () => {
  const storage = memoryStorage();
  writeConsent(storage, "denied");
  assert.equal(storage.getItem(CONSENT_STORAGE_KEY), "0");
  writeConsent(storage, "granted");
  assert.equal(storage.getItem(CONSENT_STORAGE_KEY), "1");
});

test("the banner shows until a first choice and cannot be dismissed without one", () => {
  // Server render and hydration: the choice is not known yet.
  assert.deepEqual(consentBannerState(undefined, false), {
    visible: false,
    dismissible: false,
  });
  assert.deepEqual(consentBannerState("pending", false), {
    visible: true,
    dismissible: false,
  });
  assert.deepEqual(consentBannerState("pending", true), {
    visible: true,
    dismissible: false,
  });
  for (const choice of ["granted", "denied"] as const) {
    assert.deepEqual(consentBannerState(choice, false), {
      visible: false,
      dismissible: false,
    });
    // Reopened from Cookie settings: it can close and keep the choice.
    assert.deepEqual(consentBannerState(choice, true), {
      visible: true,
      dismissible: true,
    });
  }
});
