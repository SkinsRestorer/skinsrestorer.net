import assert from "node:assert/strict";
import { test } from "node:test";
import { redactEditorParams } from "./analytics-redact";

test("texture hashes are removed from nested event data", () => {
  const event = {
    event: "$pageview",
    properties: {
      $current_url: "https://skinsrestorer.net/editor?texture=abc123&x=1#top",
      nested: [{ href: "/upload?texture=4f1e-22" }],
      count: 3,
    },
  };
  assert.deepEqual(redactEditorParams(event), {
    event: "$pageview",
    properties: {
      $current_url: "https://skinsrestorer.net/editor?texture=redacted&x=1#top",
      nested: [{ href: "/upload?texture=redacted" }],
      count: 3,
    },
  });
  assert.equal(redactEditorParams("/docs?q=texture"), "/docs?q=texture");
});

test("Mojang texture URLs lose their hash, plain and URL-encoded", () => {
  const hash =
    "a3f6c2b1d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d";
  assert.equal(
    redactEditorParams(`https://textures.minecraft.net/texture/${hash}`),
    "https://textures.minecraft.net/texture/redacted",
  );
  assert.equal(
    redactEditorParams(
      `/upload?url=https%3A%2F%2Ftextures.minecraft.net%2Ftexture%2F${hash}&x=1`,
    ),
    "/upload?url=https%3A%2F%2Ftextures.minecraft.net%2Ftexture%2Fredacted&x=1",
  );
  assert.equal(
    redactEditorParams("https://textures.minecraft.net/"),
    "https://textures.minecraft.net/",
  );
});

test("texture values in the fragment are removed", () => {
  assert.equal(
    redactEditorParams("https://skinsrestorer.net/studio#texture=abc123&y=2"),
    "https://skinsrestorer.net/studio#texture=redacted&y=2",
  );
  assert.equal(redactEditorParams("/docs#textures"), "/docs#textures");
});
