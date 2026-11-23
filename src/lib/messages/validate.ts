const parameters = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/gu)]
    .map(([, name = ""]) => name)
    .toSorted()
    .join(",");

const tags = (text: string) =>
  [...text.matchAll(/<(\w+)>/gu)]
    .map(([, name = ""]) => name)
    .toSorted()
    .join(",");

/** Rich-text tags must close in reverse order of opening. */
function balancedTags(text: string): boolean {
  const open: string[] = [];
  for (const [, closing, name = ""] of text.matchAll(/<(\/?)(\w+)>/gu)) {
    if (!closing) open.push(name);
    else if (open.pop() !== name) return false;
  }
  return open.length === 0;
}

/** Check catalog contracts without relying on English fallback text. */
export function validateCatalogs(
  catalogs: Record<string, Record<string, string>>,
): string[] {
  const errors: string[] = [];
  const english = catalogs["en"];
  if (!english) return ["Missing English catalog."];
  const keys = Object.keys(english);
  for (const key of keys) {
    if (!/^[a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+$/u.test(key))
      errors.push(`Invalid translation key: ${key}`);
  }
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const [key, source] of Object.entries(english)) {
      const value = catalog[key];
      if (typeof value !== "string" || !value.trim()) {
        errors.push(`${locale}: missing translation for ${key}`);
        continue;
      }
      if (parameters(value) !== parameters(source))
        errors.push(`${locale}: interpolation parameters differ for ${key}`);
      if (!balancedTags(value))
        errors.push(`${locale}: unbalanced rich-text tags in ${key}`);
      else if (tags(value) !== tags(source))
        errors.push(`${locale}: rich-text tags differ for ${key}`);
    }
    for (const key of Object.keys(catalog)) {
      if (!Object.hasOwn(english, key))
        errors.push(`${locale}: unknown translation key ${key}`);
    }
  }
  return errors;
}

const quotedKey = /["'`]([a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+)["'`]/gu;

/**
 * Catalog keys that no source file names in quotes. `dynamic` lists keys
 * that code builds at runtime, such as t(`editor.${next}`).
 */
export function findUnusedKeys(
  keys: readonly string[],
  sources: readonly string[],
  dynamic: readonly string[] = [],
): string[] {
  const used = new Set(dynamic);
  for (const source of sources)
    for (const [, key = ""] of source.matchAll(quotedKey)) used.add(key);
  return keys.filter((key) => !used.has(key));
}
