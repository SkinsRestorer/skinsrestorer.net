import { catalogs } from "../src/lib/messages";
import { validateCatalogs } from "../src/lib/messages/validate";
import { runTool, toolTry } from "./lib/runtime";

const check = toolTry("validate translations", () => {
  const errors = validateCatalogs(catalogs);
  if (errors.length) throw new Error(errors.join("\n"));
  return `Validated ${Object.keys(catalogs.en).length} translation keys in ${Object.keys(catalogs).length} locales.`;
});
if (import.meta.main) await runTool(check, console.log);
