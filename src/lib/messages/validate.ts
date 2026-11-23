const parameters = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/gu)]
    .map(([, name = ""]) => name)
    .toSorted()
    .join(",");

/**
 * The tag tree of a rich message, such as `a(b,{n})`, or undefined when its
 * tags are unbalanced. Text is ignored and siblings are sorted, so a
 * translation can reword and reorder, but cannot nest, move, or rename tags
 * and placeholders.
 */
function richStructure(text: string): string | undefined {
  const stack: { name: string; children: string[] }[] = [
    { name: "", children: [] },
  ];
  for (const [, closing, tag, placeholder] of text.matchAll(
    /<(\/?)(\w+)>|\{(\w+)\}/gu,
  )) {
    const current = stack.at(-1);
    if (!current) return undefined;
    if (placeholder !== undefined) current.children.push(`{${placeholder}}`);
    else if (!closing) stack.push({ name: tag ?? "", children: [] });
    else {
      if (stack.length < 2 || current.name !== tag) return undefined;
      stack.pop();
      stack
        .at(-1)
        ?.children.push(`${tag}(${current.children.toSorted().join(",")})`);
    }
  }
  const [root] = stack;
  return stack.length === 1 && root
    ? root.children.toSorted().join(",")
    : undefined;
}

/** Tag and placeholder names of a rich message, sorted. */
function richNames(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(/<(\w+)>|\{(\w+)\}/gu)].map(
        ([, tag, placeholder]) => tag ?? placeholder ?? "",
      ),
    ),
  ].toSorted();
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
      const structure = richStructure(value);
      if (structure === undefined)
        errors.push(`${locale}: unbalanced rich-text tags in ${key}`);
      else if (structure !== richStructure(source))
        errors.push(`${locale}: rich-text tags differ for ${key}`);
    }
    for (const key of Object.keys(catalog)) {
      if (!Object.hasOwn(english, key))
        errors.push(`${locale}: unknown translation key ${key}`);
    }
  }
  return errors;
}

/**
 * The names each `t.rich` key declares must equal the tags and placeholders
 * of its English message, so the typed values cover the whole message.
 */
export function validateRichNames(
  english: Record<string, string>,
  declared: Record<string, readonly string[]>,
): string[] {
  return Object.entries(declared).flatMap(([key, names]) => {
    const source = english[key];
    if (source === undefined) return [`Unknown rich message key: ${key}`];
    const expected = richNames(source).join(",");
    const actual = names.toSorted().join(",");
    return expected === actual
      ? []
      : [`Rich message ${key} declares ${actual}, English has ${expected}`];
  });
}

const quotedKey = /["'`]([a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+)["'`]/gu;

/** Catalog keys that no source file names in quotes. */
export function findUnusedKeys(
  keys: readonly string[],
  sources: readonly string[],
): string[] {
  const used = new Set<string>();
  for (const source of sources)
    for (const [, key = ""] of source.matchAll(quotedKey)) used.add(key);
  return keys.filter((key) => !used.has(key));
}

/**
 * English values that more than one key uses, with those keys. Each entry is
 * a candidate for one shared key, unless the contexts need different
 * translations.
 */
export function findDuplicateValues(
  english: Record<string, string>,
): [value: string, keys: string[]][] {
  const keysByValue = Map.groupBy(
    Object.entries(english),
    ([, value]) => value,
  );
  return [...keysByValue].flatMap(([value, entries]) =>
    entries.length > 1 ? [[value, entries.map(([key]) => key)]] : [],
  );
}
