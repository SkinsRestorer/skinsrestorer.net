import type { Rgba } from "@/lib/skin-paint";

export function toHex(color: Rgba) {
  return `#${color
    .slice(0, 3)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function parseHex(value: string): [number, number, number] | undefined {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!match) return undefined;
  const [, digits = ""] = match;
  const hex =
    digits.length === 3
      ? Array.from(digits)
          .map((c) => c + c)
          .join("")
      : digits;
  const channel = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return [channel(0), channel(2), channel(4)];
}
