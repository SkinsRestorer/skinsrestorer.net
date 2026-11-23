/**
 * A browser DOM for tests that check focus and interaction. Only test files
 * import this module.
 *
 * Call `registerDom()` at the top of a test file. It registers happy-dom
 * globals before the file's tests and removes them after, so other test
 * files keep the plain Bun runtime with its own `fetch`, `Request`, and `URL`.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { after, before } from "node:test";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function registerDom() {
  before(() => {
    GlobalRegistrator.register({ url: "https://skinsrestorer.net/" });
    // Tell React that `act` wraps every update in these tests.
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  });
  after(async () => {
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    await GlobalRegistrator.unregister();
  });
}

/**
 * Render `node` into a new element in `document.body`. `rerender` replaces
 * it, and `unmount` removes it with its container.
 */
export function render(node: ReactNode) {
  const container = document.createElement("div");
  document.body.insertAdjacentElement("beforeend", container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return {
    container,
    rerender(next: ReactNode) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Click `element` and apply the resulting React updates. */
export function click(element: HTMLElement) {
  act(() => {
    element.click();
  });
}
