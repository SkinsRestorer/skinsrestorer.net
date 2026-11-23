import assert from "node:assert/strict";
import { test } from "node:test";
import { CONSENT_STORAGE_KEY } from "./analytics-consent";
import { createAnalytics } from "./analytics";

function setup(stored?: string) {
  const items = new Map<string, string>();
  if (stored !== undefined) items.set(CONSENT_STORAGE_KEY, stored);
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
  const calls: string[] = [];
  let loads = 0;
  const posthog = {
    init: (token: string) => {
      calls.push(`init ${token}`);
      return undefined;
    },
    capture: (event: string) => {
      calls.push(`capture ${event}`);
      return { uuid: "1", event, properties: {} };
    },
    opt_in_capturing: () => {
      calls.push("opt_in");
    },
    opt_out_capturing: () => {
      calls.push("opt_out");
    },
    stopSessionRecording: () => {
      calls.push("stop_recording");
    },
  };
  let allowed = 0;
  let declined = 0;
  const analytics = createAnalytics({
    token: "phc_test",
    storage: () => storage,
    loadPostHog: () => {
      loads++;
      return Promise.resolve(posthog);
    },
    onAllowed: () => {
      allowed++;
    },
    onDeclined: () => {
      declined++;
    },
  });
  return {
    analytics,
    calls,
    items,
    loads: () => loads,
    allowed: () => allowed,
    declined: () => declined,
  };
}

const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

test("without a choice, PostHog is not loaded and events are not sent", async () => {
  const { analytics, loads, allowed, calls } = setup();
  analytics.startIfAllowed();
  assert.equal(analytics.getConsent(), "pending");
  assert.equal(await analytics.capture("on_rate_docs"), false);
  await settle();
  assert.equal(loads(), 0);
  assert.equal(allowed(), 0);
  assert.deepEqual(calls, []);
});

test("a stored decline keeps PostHog unloaded", async () => {
  const { analytics, loads } = setup("0");
  analytics.startIfAllowed();
  await settle();
  assert.equal(analytics.getConsent(), "denied");
  assert.equal(loads(), 0);
});

test("a stored allow loads and initializes PostHog once", async () => {
  const { analytics, loads, calls, allowed } = setup("1");
  analytics.startIfAllowed();
  assert.equal(await analytics.capture("on_rate_docs"), true);
  assert.equal(loads(), 1);
  assert.equal(allowed(), 1);
  assert.deepEqual(calls, ["init phc_test", "capture on_rate_docs"]);
});

test("allowing stores the choice, notifies listeners, and starts PostHog", async () => {
  const { analytics, items, calls, allowed } = setup();
  let notified = 0;
  analytics.subscribe(() => {
    notified++;
  });
  analytics.allow();
  await settle();
  assert.equal(items.get(CONSENT_STORAGE_KEY), "1");
  assert.equal(analytics.getConsent(), "granted");
  assert.equal(notified, 1);
  assert.equal(allowed(), 1);
  assert.deepEqual(calls, ["init phc_test", "capture $opt_in"]);
});

test("declining after allowing stops capture, session replay, and Ahrefs", async () => {
  const { analytics, items, calls, declined } = setup("1");
  analytics.startIfAllowed();
  await settle();
  analytics.decline();
  assert.equal(items.get(CONSENT_STORAGE_KEY), "0");
  assert.equal(declined(), 1);
  assert.equal(await analytics.capture("on_rate_docs"), false);
  assert.deepEqual(calls, ["init phc_test", "opt_out", "stop_recording"]);
  // Allowing again restarts the same instance instead of a second init.
  analytics.allow();
  assert.deepEqual(calls.slice(3), ["opt_in"]);
});

test("declining while PostHog loads keeps it from initializing", async () => {
  const { analytics, calls, loads } = setup();
  analytics.allow();
  analytics.decline();
  await settle();
  assert.equal(loads(), 1);
  assert.deepEqual(calls, []);
});

test("a decline in another tab stops analytics in this tab", async () => {
  const { analytics, items, calls, declined } = setup("1");
  analytics.startIfAllowed();
  await settle();
  let notified = 0;
  analytics.subscribe(() => {
    notified++;
  });
  items.set(CONSENT_STORAGE_KEY, "0");
  analytics.syncStoredConsent();
  assert.equal(analytics.getConsent(), "denied");
  assert.equal(notified, 1);
  assert.equal(declined(), 1);
  assert.equal(await analytics.capture("on_rate_docs"), false);
  assert.deepEqual(calls, ["init phc_test", "opt_out", "stop_recording"]);
  // The same value again changes nothing.
  analytics.syncStoredConsent();
  assert.equal(notified, 1);
  assert.equal(declined(), 1);
  assert.equal(calls.length, 3);
});

test("an allow in another tab starts PostHog without a second $opt_in", async () => {
  const { analytics, items, calls, allowed } = setup();
  assert.equal(analytics.getConsent(), "pending");
  items.set(CONSENT_STORAGE_KEY, "1");
  analytics.syncStoredConsent();
  await settle();
  assert.equal(analytics.getConsent(), "granted");
  assert.equal(allowed(), 1);
  assert.deepEqual(calls, ["init phc_test"]);
});
