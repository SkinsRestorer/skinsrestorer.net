import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRichTranslator, formatRich } from "./i18n-react";

const html = (node: ReactNode) => renderToStaticMarkup(<div>{node}</div>);
const docs = <a href="/docs">placeholder</a>;

function Ago({ minutes }: { minutes: number }) {
  return <time>{minutes} minutes ago</time>;
}

test("rich messages wrap tagged text and keep the translated word order", () => {
  assert.equal(
    html(
      formatRich("Краткие ответы. Подробности в <docs>документации</docs>.", {
        docs,
      }),
    ),
    '<div>Краткие ответы. Подробности в <a href="/docs">документации</a>.</div>',
  );
});

test("nested tags and placeholders render inside their wrappers", () => {
  assert.equal(
    html(
      formatRich("Use <b>the <docs>docs</docs> and {command}</b> now", {
        b: <strong />,
        docs,
        command: <code>/skin url</code>,
      }),
    ),
    '<div>Use <strong>the <a href="/docs">docs</a> and <code>/skin url</code></strong> now</div>',
  );
});

test("placeholders accept React elements such as a relative time", () => {
  assert.equal(
    html(
      formatRich("{name}, changed {time}", {
        name: "Steve",
        time: <Ago minutes={5} />,
      }),
    ),
    "<div>Steve, changed <time>5 minutes ago</time></div>",
  );
});

test("missing tag values keep the text and missing placeholders stay visible", () => {
  assert.equal(
    html(formatRich("Read the <docs>guide</docs>.")),
    "<div>Read the guide.</div>",
  );
  assert.equal(html(formatRich("Hello {name}")), "<div>Hello {name}</div>");
  assert.equal(
    html(formatRich("Broken <a>link and </b> stray", { a: docs })),
    "<div>Broken &lt;a&gt;link and &lt;/b&gt; stray</div>",
  );
  assert.equal(
    html(formatRich("<toString>{constructor}</toString>")),
    "<div>{constructor}</div>",
  );
});

test("the translator formats catalog messages by key in each locale", () => {
  const t = createRichTranslator("ru");
  assert.equal(
    html(
      t.rich("studio.draftChanged", {
        name: "Steve",
        time: <Ago minutes={1} />,
      }),
    ),
    "<div>Steve, изменено <time>1 minutes ago</time></div>",
  );
  assert.equal(t("common.allowAnalytics"), "Разрешить аналитику");
});

test("rich values must name each tag and placeholder of the message", () => {
  const t = createRichTranslator("en");
  // @ts-expect-error A misspelled name would drop the link silently.
  void t.rich("home.faqIntro", { doc: docs });
  // @ts-expect-error A forgotten placeholder would render as {time}.
  void t.rich("studio.draftChanged", { name: "Steve" });
  // @ts-expect-error Messages without markup are not rich messages.
  void t.rich("common.allowAnalytics", {});
  assert.equal(
    html(t.rich("home.faqIntro", { docs })),
    '<div>Short answers. The <a href="/docs">documentation</a> has the details.</div>',
  );
});
