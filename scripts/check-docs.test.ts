import assert from "node:assert/strict";
import { test } from "node:test";
import { websiteSourceHash } from "./check-docs";

test("website source hashes ignore formatting, comments, and types", () => {
  const original = `import { load } from "./load";
// Load the skin.
export function Skin({ id }: { id: string }) {
  return <img alt="" src={load(id)} />;
}
`;
  const formatted = `import {load} from './load'
export function Skin({id}) {
  return (
    <img
      alt=""
      src={load(id)}
    />
  )
}
`;
  assert.equal(websiteSourceHash(original), websiteSourceHash(formatted));
  assert.equal(
    websiteSourceHash(original.replaceAll("\n", "\r\n")),
    websiteSourceHash(original),
  );
});

test("website source hashes change with runtime behavior", () => {
  assert.notEqual(
    websiteSourceHash(`export const limit = 10;`),
    websiteSourceHash(`export const limit = 20;`),
  );
  assert.notEqual(
    websiteSourceHash(`export const label = "Upload";`),
    websiteSourceHash(`export const label = "Upload skin";`),
  );
});

test("website source hashes keep both NODE_ENV branches", () => {
  for (const branch of ["production", "development"]) {
    assert.notEqual(
      websiteSourceHash(`if (process.env.NODE_ENV === "${branch}") upload(1);`),
      websiteSourceHash(`if (process.env.NODE_ENV === "${branch}") upload(2);`),
      branch,
    );
  }
});
