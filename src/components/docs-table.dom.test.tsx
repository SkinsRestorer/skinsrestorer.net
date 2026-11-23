import assert from "node:assert/strict";
import { test } from "node:test";
import { Heading } from "fumadocs-ui/components/heading";
import { render, registerDom } from "@/test/dom";
import { DocsTable } from "./docs-table";

registerDom();

function Table() {
  return (
    <DocsTable>
      <tbody>
        <tr>
          <td>/skin set</td>
        </tr>
      </tbody>
    </DocsTable>
  );
}

test("each wide table scrolls in a focusable region named by its nearest heading", () => {
  const view = render(
    <article>
      <h1>Commands and permissions</h1>
      <Table />
      <Heading as="h2" id="player-commands">
        Player commands
      </Heading>
      <p>Players run these commands.</p>
      <div>
        <Table />
      </div>
    </article>,
  );
  const regions = [...view.container.querySelectorAll("section")];
  assert.deepEqual(
    regions.map((region) => region.getAttribute("aria-label")),
    ["Commands and permissions", "Player commands"],
  );
  for (const region of regions) {
    assert.equal(region.tabIndex, 0);
    assert.ok(region.querySelector("table"));
  }
  view.unmount();
});

test("a table without a heading before it has no made-up name", () => {
  const view = render(<Table />);
  assert.equal(
    view.container.querySelector("section")?.hasAttribute("aria-label"),
    false,
  );
  view.unmount();
});
