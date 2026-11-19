import assert from "node:assert/strict";
import { test } from "node:test";
import { required } from "./utils";

test("required returns present values, including falsy ones", () => {
  assert.equal(required(0, "count"), 0);
  assert.equal(required("", "name"), "");
  assert.equal(required(false, "flag"), false);
});

test("required names the missing value", () => {
  assert.throws(
    () => {
      required(undefined, "skin id");
    },
    {
      message: "Missing skin id",
    },
  );
  assert.throws(() => required(null, "canvas context"), {
    message: "Missing canvas context",
  });
});
