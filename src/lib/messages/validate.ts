/** Check catalog contracts without relying on English fallback text. */
export function validateCatalogs(
  catalogs: Record<string, Record<string, string>>,
): string[] {
  const errors: string[] = [];
  const english = catalogs.en;
  if (!english) return ["Missing English catalog."];
  const keys = Object.keys(english);
  const parameters = (text: string) =>
    [...text.matchAll(/\{(\w+)\}/g)]
      .map((match) => match[1])
      .sort()
      .join(",");
  for (const key of keys) {
    if (!/^[a-z][a-z0-9]*(?:\.[a-zA-Z0-9]+)+$/.test(key))
      errors.push(`Invalid translation key: ${key}`);
  }
  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const key of keys) {
      const value = catalog[key];
      if (typeof value !== "string" || !value.trim())
        errors.push(`${locale}: missing translation for ${key}`);
      else if (parameters(value) !== parameters(english[key]))
        errors.push(`${locale}: interpolation parameters differ for ${key}`);
    }
    for (const key of Object.keys(catalog)) {
      if (!Object.hasOwn(english, key))
        errors.push(`${locale}: unknown translation key ${key}`);
    }
  }
  return errors;
}
