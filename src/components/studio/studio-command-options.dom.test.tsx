import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act } from "react";
import type { SelectedSkin } from "@/lib/skin-selection";
import type { StudioPurpose } from "@/lib/studio";
import { click, render, registerDom } from "@/test/dom";
import { mockFetch } from "@/test/fakes";
import { StudioCommandOptions } from "./studio-command-options";
import { useStudioCommandForm } from "./use-studio-command-form";

registerDom();

const noop = () => {};

// Every request fails, so the public cape list and the upload fail fast.
let fetchMock: ReturnType<typeof mockFetch>;
beforeEach(() => {
  fetchMock = mockFetch(() =>
    Response.json({ errors: [{ message: "Bad request" }] }, { status: 400 }),
  );
});
afterEach(() => {
  fetchMock.restore();
});

function Harness(props: { file: File; intent: StudioPurpose }) {
  const current: SelectedSkin = {
    token: 1,
    file: props.file,
    name: props.file.name,
    origin: "file",
    status: "ready",
    keep: { kind: "kept" },
  };
  const command = useStudioCommandForm({
    entry: "studio",
    intent: props.intent,
    file: props.file,
    variant: "classic",
    current,
    pendingGallery: undefined,
  });
  return (
    <StudioCommandOptions
      command={command}
      current={current}
      variant="classic"
      onVariant={noop}
    />
  );
}

function skinFile() {
  return new File([new Uint8Array([137, 80, 78, 71])], "skin.png", {
    type: "image/png",
  });
}

function button(container: HTMLElement, name: string) {
  const match = [...container.querySelectorAll("button")].find(
    (element) => element.textContent === name,
  );
  assert.ok(match, `No "${name}" button`);
  return match;
}

/**
 * Type like a visitor, with the input and keyup events of a keystroke. React
 * ignores values set through the element itself, and React DOM loads before
 * the DOM exists, so it watches keyup instead of input.
 */
function type(input: HTMLInputElement, value: string) {
  act(() => {
    input.focus();
    // The prototype's setter skips the value tracker React adds to the input.
    assert.ok(Reflect.set(Object.getPrototypeOf(input), "value", value, input));
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  });
}

/** Let pending requests settle and apply their React updates. */
async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 100 && !check(); attempt++)
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    });
  assert.ok(check(), "The condition never held");
}

test("an invalid skin name offers a one-click fix that returns focus to the name", () => {
  const view = render(<Harness file={skinFile()} intent="createcustom" />);
  const input = view.container.querySelector("input");
  assert.ok(input);
  type(input, "Lobby Skin");

  const nameError = () =>
    view.container.querySelector('[data-slot="field-error"]')?.textContent;
  assert.equal(nameError(), "Use lowercase letters, numbers, and underscores.");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  const generate = button(view.container, "Generate /sr createcustom");
  assert.ok(generate.disabled);

  // A click focuses the link, which unmounts once the name is fixed.
  const fix = button(view.container, "Use lobby_skin");
  fix.focus();
  click(fix);

  assert.equal(input.value, "lobby_skin");
  assert.equal(input.getAttribute("aria-invalid"), null);
  assert.equal(nameError(), undefined);
  assert.ok(!generate.disabled);
  assert.equal(document.activeElement, input);
  view.unmount();
});

test("a failed upload returns focus to Generate without sending it again", async () => {
  const view = render(<Harness file={skinFile()} intent="skin-url" />);
  const generate = button(view.container, "Generate /skin url");
  click(generate);
  assert.ok(generate.disabled);
  // The disabled button loses focus while the upload is pending.
  generate.blur();

  // The button comes back once the submit ends, after the failure shows.
  await waitFor(() => !generate.disabled);
  assert.ok(view.container.textContent.includes("The skin was not uploaded"));
  assert.equal(document.activeElement, generate);
  const uploads = fetchMock.calls.filter(
    (call) => call.init?.method === "POST",
  );
  assert.equal(uploads.length, 1);
  view.unmount();
});
