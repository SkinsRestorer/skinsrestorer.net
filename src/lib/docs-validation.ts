import { parseDocument } from "yaml";

export interface ConfigProperty {
  key: string;
  type: string;
  default: unknown;
  min?: number;
  max?: number;
}

export function parseYaml(text: string): unknown {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) {
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  }
  return document.toJS();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate partial configuration against the release's declared properties. */
export function validateConfig(
  value: unknown,
  properties: readonly ConfigProperty[],
): string[] {
  const errors: string[] = [];
  const keys = new Map(properties.map((property) => [property.key, property]));

  function visit(value: unknown, key: string) {
    const property = keys.get(key);
    if (property) {
      const valid = (() => {
        switch (property.type) {
          case "Boolean":
            return typeof value === "boolean";
          case "Integer":
            return (
              typeof value === "number" &&
              Number.isInteger(value) &&
              (property.min === undefined || value >= property.min) &&
              (property.max === undefined || value <= property.max)
            );
          case "List<String>":
            return (
              Array.isArray(value) && value.every((v) => typeof v === "string")
            );
          case "DatabaseType":
            return ["FILE", "MYSQL", "POSTGRESQL"].includes(String(value));
          case "ProxyMode":
            return ["ENABLED", "DISABLED", "AUTO"].includes(String(value));
          case "String":
          case "Locale":
            return typeof value === "string";
          default:
            throw new Error(`Unknown inventory type: ${property.type}`);
        }
      })();
      if (!valid) errors.push(`${key}: expected ${property.type}`);
      return;
    }
    if (
      !isRecord(value) ||
      (key &&
        !properties.some((property) => property.key.startsWith(`${key}.`)))
    ) {
      errors.push(`${key || "configuration"}: unknown key or invalid section`);
      return;
    }
    for (const [name, child] of Object.entries(value)) {
      visit(child, key ? `${key}.${name}` : name);
    }
  }
  visit(value, "");
  return errors;
}
