import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Schema } from "effect";
import { createDiscordEmbed, serializeDiscordEmbed } from "./discord-embed";

// The parts of the Discord component payload these tests read.
const decodePayload = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      component: Schema.Struct({
        components: Schema.Array(
          Schema.Struct({
            content: Schema.optional(Schema.String),
            components: Schema.optional(
              Schema.Array(
                Schema.Struct({ url: Schema.optional(Schema.String) }),
              ),
            ),
          }),
        ),
      }),
    }),
  ),
);

test("serializes page content and navigation as safe, bounded Discord JSON", () => {
  const embed = createDiscordEmbed({
    title: "</script> New guide",
    description: "Read the latest guide",
    url: "https://example.com/guide",
    links: [{ label: "Installation", url: "https://example.com/install" }],
    images: ["https://example.com/image.png"],
  });
  assert.ok(embed);
  const json = serializeDiscordEmbed(embed);
  assert.ok(!json.includes("<"));
  const payload = decodePayload(json);
  assert.match(payload.component.components[0]?.content ?? "", /New guide/u);
  assert.equal(
    payload.component.components.at(-1)?.components?.[1]?.url,
    "https://example.com/install",
  );
  const card = createDiscordEmbed({
    title: "🌍".repeat(200),
    description: "🌍</script>".repeat(1000),
    url: "https://example.com",
    images: [`https://example.com/${"x".repeat(1900)}`],
  });
  assert.ok(card);
  assert.ok(
    new TextEncoder().encode(serializeDiscordEmbed(card)).byteLength <= 3000,
  );
});

test("omits unsupported URLs instead of creating unsafe buttons", () => {
  assert.equal(
    // oxlint-disable-next-line eslint/no-script-url -- Verify that embeds reject script URLs.
    createDiscordEmbed({ title: "Bad", url: "javascript:alert(1)" }),
    undefined,
  );
  const embed = createDiscordEmbed({
    title: "Good",
    url: "https://example.com",
    links: [{ label: "Bad", url: "file:///tmp/data" }],
  });
  assert.ok(embed);
  assert.equal(
    decodePayload(serializeDiscordEmbed(embed)).component.components.at(-1)
      ?.components?.length,
    1,
  );
});

test("keeps the title link whole when the page URL has parentheses", () => {
  const card = createDiscordEmbed({
    title: "Guide",
    url: "https://example.com/docs/skin_(slim)",
  });
  assert.ok(card);
  const payload = decodePayload(serializeDiscordEmbed(card));
  assert.equal(
    payload.component.components[0]?.content,
    "## [Guide](https://example.com/docs/skin_%28slim%29)",
  );
});
