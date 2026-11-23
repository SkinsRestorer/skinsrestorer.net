import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DocsTable } from "./docs-table";

test("a docs table scrolls inside a named, focusable region", () => {
  const html = renderToStaticMarkup(
    <DocsTable>
      <tbody>
        <tr>
          <td>/skin set</td>
        </tr>
      </tbody>
    </DocsTable>,
  );
  const region = /^<section[^>]*>/u.exec(html)?.[0] ?? "";
  assert.ok(region.includes('aria-label="Scrollable table"'));
  assert.ok(region.includes('tabindex="0"'));
  assert.ok(html.includes("<table><tbody>"));
});
