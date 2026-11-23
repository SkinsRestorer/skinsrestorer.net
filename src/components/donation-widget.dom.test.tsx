import assert from "node:assert/strict";
import { test } from "node:test";
import { click, render, registerDom } from "@/test/dom";
import { DonationWidget } from "./donation-widget";

registerDom();

test("showing the donation form loads it and moves focus into it", () => {
  const view = render(
    <DonationWidget
      href="https://ko-fi.com/skinsrestorer"
      label="Open Ko-fi"
      // `srcDoc` stands in for the checkout page, which the test DOM cannot load.
      frame={{ srcDoc: "<p>Checkout</p>", title: "Ko-fi donation form" }}
    />,
  );
  assert.equal(view.container.querySelector("iframe"), null);

  const show = [...view.container.querySelectorAll("button")].find(
    (element) => element.textContent === "Show the donation form",
  );
  assert.ok(show, "No button shows the donation form");
  show.focus();
  click(show);

  const frame = view.container.querySelector("iframe");
  assert.ok(frame, "The donation form did not load");
  assert.equal(frame.title, "Ko-fi donation form");
  assert.equal(document.activeElement, frame);
  assert.equal(view.container.querySelector("button"), null);
  view.unmount();
});
