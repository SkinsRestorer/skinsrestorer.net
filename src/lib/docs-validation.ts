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
  if (document.errors.length > 0) {
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

  function visit(node: unknown, key: string) {
    const property = keys.get(key);
    if (property) {
      const valid = (() => {
        switch (property.type) {
          case "Boolean":
            return typeof node === "boolean";
          case "Integer":
            return (
              typeof node === "number" &&
              Number.isInteger(node) &&
              (property.min === undefined || node >= property.min) &&
              (property.max === undefined || node <= property.max)
            );
          case "List<String>":
            return (
              Array.isArray(node) && node.every((v) => typeof v === "string")
            );
          case "DatabaseType":
            return ["FILE", "MYSQL", "POSTGRESQL"].includes(String(node));
          case "ProxyMode":
            return ["ENABLED", "DISABLED", "AUTO"].includes(String(node));
          case "String":
          case "Locale":
            return typeof node === "string";
          default:
            throw new Error(`Unknown inventory type: ${property.type}`);
        }
      })();
      if (!valid) errors.push(`${key}: expected ${property.type}`);
      return;
    }
    if (
      !isRecord(node) ||
      (key &&
        !properties.some((candidate) => candidate.key.startsWith(`${key}.`)))
    ) {
      errors.push(`${key || "configuration"}: unknown key or invalid section`);
      return;
    }
    for (const [name, child] of Object.entries(node)) {
      visit(child, key ? `${key}.${name}` : name);
    }
  }
  visit(value, "");
  return errors;
}
