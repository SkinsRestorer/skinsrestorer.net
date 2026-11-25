import assert from "node:assert/strict";
import { before, test } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { act, useEffect } from "react";
import { message } from "@/lib/messages";
import { render, registerDom } from "@/test/dom";
import { LIBRARY_CHANNEL, LIBRARY_DB } from "../skin-library";
import { useSkinLibrary, type LibraryState } from "./use-skin-library";

registerDom();

const factory = new IDBFactory();
before(() => {
  // The page's library opens the browser's IndexedDB.
  Reflect.set(globalThis, "IDBFactory", IDBFactory);
  Reflect.set(globalThis, "indexedDB", factory);
});

let shown: LibraryState = { status: "loading" };
function Probe(props: { readonly onState: (state: LibraryState) => void }) {
  const { state } = useSkinLibrary();
  const { onState } = props;
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return null;
}
const show = (state: LibraryState) => {
  shown = state;
};

async function until(done: () => boolean) {
  for (let attempt = 0; attempt < 100 && !done(); attempt++)
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });
    });
  assert.ok(done(), `library state stayed ${JSON.stringify(shown)}`);
}

test("a change in another tab reads the listing again", async () => {
  const view = render(<Probe onState={show} />);
  await until(() => shown.status === "ready");
  const first = shown;

  const otherTab = new BroadcastChannel(LIBRARY_CHANNEL);
  act(() => {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no target origin.
    otherTab.postMessage({ type: "changed" });
  });
  await until(() => shown !== first && shown.status === "ready");
  otherTab.close();
  view.unmount();
});

test("a database closed by a newer page asks for a reload", async () => {
  const view = render(<Probe onState={show} />);
  await until(() => shown.status === "ready");

  // Another tab opens a newer database version, so this page must close.
  const upgrade = factory.open(LIBRARY_DB, 2);
  await until(() => shown.status === "unavailable");
  assert.deepEqual(shown, {
    status: "unavailable",
    message: message("library.anotherTabUpdatedSkinsReloadPage"),
    reload: true,
  });
  view.unmount();
  upgrade.result.close();
});
