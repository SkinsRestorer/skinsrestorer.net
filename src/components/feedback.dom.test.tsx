import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act } from "react";
import { analytics } from "@/lib/analytics";
import type { ConsentChoice } from "@/lib/analytics-consent";
import { click, render, registerDom } from "@/test/dom";
import { Feedback } from "./feedback";

registerDom();

const url = "/docs/installation";
const version = "15.12.6";
const storageKey = `docs-feedback-${version}-${url}`;

const original = { ...analytics };
let sent: { event: string; properties?: Record<string, unknown> }[];
let accepted: boolean;

/** Fake PostHog: record events and accept them unless a test says not to. */
function stubAnalytics(consent: ConsentChoice) {
  Object.assign(analytics, {
    getConsent: () => consent,
    capture: (event: string, properties?: Record<string, unknown>) => {
      sent.push({ event, ...(properties ? { properties } : {}) });
      return Promise.resolve(accepted);
    },
  });
}

beforeEach(() => {
  sent = [];
  accepted = true;
  localStorage.clear();
  stubAnalytics("granted");
});

afterEach(() => {
  Object.assign(analytics, original);
});

function renderFeedback() {
  return render(
    <Feedback
      url={url}
      version={version}
      reportUrl="https://github.com/SkinsRestorer/skinsrestorer.net/issues/new"
    />,
  );
}

function button(container: HTMLElement, name: string) {
  const match = [...container.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === name,
  );
  assert.ok(match, `No "${name}" button`);
  return match;
}

/**
 * Type like a visitor, with the input and keyup events of a keystroke. React
 * ignores values set through the element itself, and React DOM loads before
 * the DOM exists, so it watches keyup instead of input.
 */
function type(field: HTMLTextAreaElement, value: string) {
  act(() => {
    field.focus();
    // The prototype setter skips the value tracker that React adds.
    Reflect.set(Object.getPrototypeOf(field), "value", value, field);
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  });
}

async function submit(container: HTMLElement) {
  await act(async () => {
    button(container, "Submit").click();
    await Promise.resolve();
  });
}

test("the rating buttons form a group named by the question", () => {
  const view = renderFeedback();
  try {
    const group = view.container.querySelector("fieldset");
    const question = document.querySelector(
      `[id="${group?.getAttribute("aria-labelledby") ?? ""}"]`,
    );
    assert.equal(question?.textContent, "Did this page help?");
    assert.deepEqual(
      [...(group?.querySelectorAll("button") ?? [])].map((rate) => [
        rate.textContent,
        rate.getAttribute("aria-pressed"),
      ]),
      [
        ["Yes", "false"],
        ["No", "false"],
      ],
    );
  } finally {
    view.unmount();
  }
});

test("a rating with a message is sent, remembered, and thanked", async () => {
  const view = renderFeedback();
  try {
    click(button(view.container, "Yes"));
    const field = view.container.querySelector("textarea");
    assert.ok(field);
    assert.equal(document.activeElement, field);
    assert.equal(
      button(view.container, "Yes").getAttribute("aria-pressed"),
      "true",
    );

    type(field, "  The Paper steps worked.  ");
    await submit(view.container);

    assert.deepEqual(sent, [
      {
        event: "on_rate_docs",
        properties: {
          url,
          version,
          opinion: "good",
          message: "The Paper steps worked.",
        },
      },
    ]);
    // Focus moves to the thank-you message.
    assert.equal(
      document.activeElement.textContent,
      "Thanks for your feedback.Submit again",
    );
    assert.equal(button(view.container, "Yes").disabled, true);
    assert.deepEqual(JSON.parse(localStorage.getItem(storageKey) ?? "null"), {
      opinion: "good",
      message: "The Paper steps worked.",
    });
  } finally {
    view.unmount();
  }
});

test("a failed send keeps the message so the visitor can try again", async () => {
  accepted = false;
  const view = renderFeedback();
  try {
    click(button(view.container, "No"));
    const field = view.container.querySelector("textarea");
    assert.ok(field);
    type(field, "Step 3 is wrong");
    await submit(view.container);

    assert.ok(
      view.container.textContent.includes(
        "Your feedback was not sent. Try again later.",
      ),
    );
    assert.equal(field.value, "Step 3 is wrong");
    assert.equal(localStorage.getItem(storageKey), null);

    accepted = true;
    await submit(view.container);
    assert.equal(sent.length, 2);
    assert.equal(view.container.querySelector("textarea"), null);
  } finally {
    view.unmount();
  }
});

test("a negative rating points to Discord and a GitHub report", () => {
  const view = renderFeedback();
  try {
    click(button(view.container, "No"));
    const links = [...view.container.querySelectorAll("a")].map((link) => [
      link.textContent,
      link.getAttribute("href"),
    ]);
    assert.deepEqual(links, [
      ["ask on Discord", "/discord"],
      [
        "Report a problem with this page on GitHub",
        "https://github.com/SkinsRestorer/skinsrestorer.net/issues/new",
      ],
    ]);
  } finally {
    view.unmount();
  }
});

test("without analytics consent, a rating asks for it instead of a message", () => {
  stubAnalytics("denied");
  const view = renderFeedback();
  try {
    click(button(view.container, "Yes"));
    assert.equal(view.container.querySelector("textarea"), null);
    assert.ok(
      view.container.textContent.includes(
        "To send it, allow analytics in the cookie settings.",
      ),
    );
    button(view.container, "Cookie settings");
    assert.deepEqual(sent, []);
  } finally {
    view.unmount();
  }
});

test("stored feedback shows the thanks, and submitting again reopens the form", () => {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ opinion: "bad", message: "" }),
  );
  const view = renderFeedback();
  try {
    assert.equal(button(view.container, "No").disabled, true);
    assert.equal(
      button(view.container, "No").getAttribute("aria-pressed"),
      "true",
    );
    click(button(view.container, "Submit again"));

    assert.equal(localStorage.getItem(storageKey), null);
    assert.equal(button(view.container, "No").disabled, false);
    assert.equal(
      button(view.container, "No").getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(view.container.querySelector("textarea"));
  } finally {
    view.unmount();
  }
});
