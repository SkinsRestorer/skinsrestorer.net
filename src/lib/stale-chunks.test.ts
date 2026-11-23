import assert from "node:assert/strict";
import { test } from "node:test";
import { createStaleChunkHandler, isPageLoading } from "./stale-chunks";

function setup(navigating: boolean) {
  const stored = new Map<string, string>();
  const state = { navigating, reloads: 0, prevented: 0, now: 1_000_000 };
  const handler = createStaleChunkHandler({
    isNavigating: () => state.navigating,
    reload: () => {
      state.reloads += 1;
    },
    storage: () => ({
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => {
        stored.set(key, value);
      },
    }),
    now: () => state.now,
  });
  const event = {
    preventDefault: () => {
      state.prevented += 1;
    },
  };
  return { handler, state, event, stored };
}

test("a chunk that fails during a navigation reloads at once", () => {
  const { handler, state, event } = setup(true);
  handler.onPreloadError(event);
  assert.equal(state.reloads, 1);
  assert.equal(state.prevented, 1);
  // A second failure within the guard window shows the error instead.
  handler.onPreloadError(event);
  assert.equal(state.reloads, 1);
});

test("a navigation reloads again once the guard window has passed", () => {
  const { handler, state, event } = setup(true);
  handler.onPreloadError(event);
  state.now += 59_999;
  handler.onPreloadError(event);
  assert.equal(state.reloads, 1);
  state.now += 1;
  handler.onPreloadError(event);
  assert.equal(state.reloads, 2);
  assert.equal(state.prevented, 2);
});

test("an unreadable reload time does not block a reload", () => {
  const { handler, state, event, stored } = setup(true);
  stored.set("skinsrestorer:stale-chunk-reload", "not a time");
  handler.onPreloadError(event);
  assert.equal(state.reloads, 1);
});

test("a failed hover preload waits for the next page change", () => {
  const { handler, state, event } = setup(false);
  handler.onPreloadError(event);
  assert.equal(state.reloads, 0);
  // The importer gets the real error, not a module that resolves to nothing.
  assert.equal(state.prevented, 0);
  // Jumping to a fragment on the same page loads nothing new.
  handler.onBeforeNavigate({ pathChanged: false });
  assert.equal(state.reloads, 0);
  handler.onBeforeNavigate({ pathChanged: true });
  assert.equal(state.reloads, 1);
  handler.onBeforeNavigate({ pathChanged: true });
  assert.equal(state.reloads, 1);
});

test("navigations without a failed preload stay in the app", () => {
  const { handler, state } = setup(false);
  handler.onBeforeNavigate({ pathChanged: true });
  assert.equal(state.reloads, 0);
});

test("chunks fail while a page loads during hydration and navigations only", () => {
  const location = { pathname: "/" };
  assert.equal(isPageLoading(undefined), true);
  // Hydration: the first page has not resolved yet.
  assert.equal(
    isPageLoading({ status: "idle", resolvedLocation: undefined }),
    true,
  );
  assert.equal(
    isPageLoading({ status: "pending", resolvedLocation: location }),
    true,
  );
  assert.equal(
    isPageLoading({ status: "idle", resolvedLocation: location }),
    false,
  );
});
