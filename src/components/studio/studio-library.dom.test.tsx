import assert from "node:assert/strict";
import { test } from "node:test";
import { act } from "react";
import type {
  LibraryState,
  useSkinLibrary,
} from "@/lib/hooks/use-skin-library";
import { LocaleProvider } from "@/lib/locale-provider";
import type { SkinContent, StoredSkin } from "@/lib/skin-library";
import { render, registerDom } from "@/test/dom";
import { StudioLibrary } from "./studio-library";

registerDom();

const noop = () => {};
const commands = {
  upload: noop,
  create: noop,
  openSkinFile: noop,
  openTexture: noop,
};

const content: SkinContent = {
  png: new Blob([], { type: "image/png" }),
  hash: "hash",
  pixelKey: "pixels:hash",
  key: "pixels:hash:classic",
  variant: "classic",
  width: 64,
  height: 64,
};

const skin = (id: string, name: string): StoredSkin => ({
  id,
  name,
  current: content,
  original: content,
  revision: 1,
  source: { kind: "file" },
  createdAt: 1,
  updatedAt: 1,
  lastUsedAt: 1,
});

const harbor = skin("a", "Harbor");
const forest = skin("b", "Forest");
const desert = skin("c", "Desert");

const ready = (skins: readonly StoredSkin[]): LibraryState => ({
  status: "ready",
  listing: { skins: [...skins], sessions: [], damaged: [] },
});

function library(state: LibraryState) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Keyboard focus needs no library actions.
  return {
    client: undefined,
    state,
    migrated: undefined,
    actions: {},
  } as unknown as ReturnType<typeof useSkinLibrary>;
}

function view(state: LibraryState) {
  return (
    <LocaleProvider locale="en">
      <StudioLibrary
        library={library(state)}
        commands={commands}
        onSelect={noop}
        onReverted={noop}
        layout="rail"
      />
    </LocaleProvider>
  );
}

function skinButton(container: HTMLElement, id: string) {
  const button = container.querySelector<HTMLButtonElement>(
    `button[data-skin-id="${id}"]`,
  );
  assert.ok(button, `No skin button for ${id}`);
  return button;
}

function press(
  element: HTMLElement,
  key: string,
  init: KeyboardEventInit = {},
) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

/** Focus `element` and apply the Tab stop update. */
function focus(element: HTMLElement) {
  act(() => {
    element.focus();
  });
}

const focusedSkin = () =>
  document.activeElement instanceof HTMLElement
    ? document.activeElement.dataset["skinId"]
    : undefined;

test("arrow keys, Home, and End move focus and the Tab stop between skins", () => {
  const page = render(view(ready([harbor, forest, desert])));
  const first = skinButton(page.container, "a");
  focus(first);

  press(first, "ArrowDown");
  assert.equal(focusedSkin(), "b");
  press(skinButton(page.container, "b"), "End");
  assert.equal(focusedSkin(), "c");
  // Past the last skin, focus stays put.
  press(skinButton(page.container, "c"), "ArrowDown");
  assert.equal(focusedSkin(), "c");
  press(skinButton(page.container, "c"), "Home");
  assert.equal(focusedSkin(), "a");
  press(skinButton(page.container, "a"), "ArrowRight");
  assert.equal(focusedSkin(), "b");

  // Tab returns to the skin that had focus last.
  assert.equal(skinButton(page.container, "b").tabIndex, 0);
  assert.equal(skinButton(page.container, "a").tabIndex, -1);
  page.unmount();
});

test("modified arrow keys leave focus alone", () => {
  const page = render(view(ready([harbor, forest])));
  const first = skinButton(page.container, "a");
  focus(first);
  press(first, "ArrowDown", { altKey: true });
  assert.equal(focusedSkin(), "a");
  page.unmount();
});
