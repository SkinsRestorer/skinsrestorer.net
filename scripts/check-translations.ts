import { Console, Effect } from "effect";
import { catalogs } from "../src/lib/messages/catalogs";
import {
  findDuplicateValues,
  findUnusedKeys,
  validateCatalogs,
  validateRichNames,
} from "../src/lib/messages/validate";
import { richMessages } from "../src/lib/rich-messages";
import { runTool, ToolError, ToolFiles, walkFiles } from "./lib/runtime";

const check = Effect.gen(function* () {
  const files = yield* ToolFiles;
  const paths = [
    ...(yield* walkFiles("src")),
    ...(yield* walkFiles("scripts")),
  ].filter((file) => /\.tsx?$/u.test(file) && !/\.test\.tsx?$/u.test(file));
  const sources = yield* Effect.forEach(paths, (file) => files.readText(file), {
    concurrency: 8,
  });
  const keys = Object.keys(catalogs.en);
  const errors = [
    ...validateCatalogs(catalogs),
    ...validateRichNames(catalogs.en, richMessages),
    ...findUnusedKeys(keys, sources).map(
      (key) => `Unused translation key: ${key}`,
    ),
  ];
  for (const [value, duplicates] of findDuplicateValues(catalogs.en))
    yield* Console.warn(
      `Duplicate English value "${value}": ${duplicates.join(", ")}`,
    );
  if (errors.length > 0)
    return yield* ToolError.make({
      operation: "validate translations",
      cause: new Error(errors.join("\n")),
    });
  return `Validated ${keys.length} translation keys in ${Object.keys(catalogs).length} locales.`;
});
if (import.meta.main)
  await runTool(check, (summary) => {
    Effect.runSync(Console.log(summary));
  });
