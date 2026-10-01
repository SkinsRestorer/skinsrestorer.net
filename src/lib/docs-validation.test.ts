import assert from "node:assert/strict";
import { test } from "node:test";
import release from "../../documentation/verified-release.json";
import { parseYaml, validateConfig } from "./docs-validation";

const validate = (value: unknown) => validateConfig(value, release.config);

test("accepts partial configuration without requiring unrelated sections", () => {
  assert.equal(
    validate({ database: { type: "POSTGRESQL", port: 5432 } }).length,
    0,
  );
  assert.equal(validate({ gui: { custom: { list: [] } } }).length, 0);
});

test("rejects a section in place of a boolean and rejects unknown nested keys", () => {
  assert.equal(
    validate({ commands: { perSkinPermissions: { enabled: true } } }).length,
    1,
  );
  assert.equal(validate({ gui: { custom: { onlyList: true } } }).length, 1);
});

test("enforces declared integer bounds and does not coerce quoted numbers", () => {
  for (const port of [0, 65536, 1.5, "3306"]) {
    assert.equal(validate({ database: { port } }).length, 1);
  }
  for (const port of [1, 65535]) {
    assert.equal(validate({ database: { port } }).length, 0);
  }
});

test("requires valid enums and lists of strings", () => {
  assert.equal(validate({ database: { type: "mysql" } }).length, 1);
  assert.equal(
    validate({ storage: { defaultSkins: { list: [false] } } }).length,
    1,
  );
  assert.equal(
    validate({ storage: { defaultSkins: { list: ["lobby"] } } }).length,
    0,
  );
});

test("rejects duplicate YAML sections rather than accepting the last value", () => {
  assert.throws(() =>
    parseYaml("database:\n  type: MYSQL\ndatabase:\n  type: FILE\n"),
  );
});

test("rejects scalar, array, and null configuration roots", () => {
  for (const value of [null, [], false, 0])
    assert.equal(validate(value).length, 1);
});
