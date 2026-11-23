import assert from "node:assert/strict";
import { test } from "node:test";
import { useState } from "react";
import { checkSkin, type SkinIssue } from "@/lib/skin-check";
import { createTemplate, pixelOffset } from "@/lib/skin-document";
import { click, render, registerDom } from "@/test/dom";
import { SkinIssueAlerts } from "./skin-issue-alerts";

registerDom();

const noop = () => {};

/** A classic skin with see-through base pixels and pixels in unused areas. */
function twoIssues() {
  const { pixels } = createTemplate("classic");
  pixels.set([60, 70, 80, 100], pixelOffset(10, 10));
  pixels.set([60, 70, 80, 255], pixelOffset(0, 0));
  const issues = checkSkin(pixels, "classic");
  assert.deepEqual(
    issues.map((issue) => issue.id),
    ["transparent-base", "unused-pixels"],
  );
  return issues;
}

/** Each repair removes its issue, as the editor does after a fix. */
function Harness(props: {
  initial: readonly SkinIssue[];
  onAllFixed: () => void;
}) {
  const [issues, setIssues] = useState(props.initial);
  return (
    <SkinIssueAlerts
      issues={issues}
      highlighted={null}
      onHighlight={noop}
      onRepair={(id) => {
        setIssues((current) => current.filter((issue) => issue.id !== id));
      }}
      onVariant={noop}
      onAllFixed={props.onAllFixed}
    />
  );
}

function button(container: HTMLElement, name: string) {
  const match = [...container.querySelectorAll("button")].find(
    (element) => element.textContent === name,
  );
  assert.ok(match, `No "${name}" button`);
  return match;
}

test("fixing an alert moves focus to the next alert's first action", () => {
  let allFixed = 0;
  const view = render(
    <Harness
      initial={twoIssues()}
      onAllFixed={() => {
        allFixed++;
      }}
    />,
  );
  try {
    const makeOpaque = button(view.container, "Make opaque");
    makeOpaque.focus();
    click(makeOpaque);

    assert.equal(makeOpaque.isConnected, false);
    assert.equal(
      document.activeElement,
      button(view.container, "Clear unused areas"),
    );
    assert.equal(allFixed, 0);
  } finally {
    view.unmount();
  }
});

test("fixing the last alert hands focus to the owner", () => {
  let allFixed = 0;
  const view = render(
    <Harness
      initial={twoIssues().slice(1)}
      onAllFixed={() => {
        allFixed++;
      }}
    />,
  );
  try {
    const clear = button(view.container, "Clear unused areas");
    clear.focus();
    click(clear);

    assert.equal(view.container.querySelector("ul"), null);
    assert.equal(allFixed, 1);
  } finally {
    view.unmount();
  }
});

test("a fix leaves focus alone when the user moved it elsewhere", () => {
  const outside = document.createElement("input");
  document.body.insertAdjacentElement("beforeend", outside);
  const view = render(<Harness initial={twoIssues()} onAllFixed={noop} />);
  try {
    const makeOpaque = button(view.container, "Make opaque");
    // A pointer click does not have to focus the button first.
    outside.focus();
    click(makeOpaque);

    assert.equal(document.activeElement, outside);
  } finally {
    view.unmount();
    outside.remove();
  }
});
