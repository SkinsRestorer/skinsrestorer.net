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
  const hex =
    match[1].length === 3
      ? Array.from(match[1])
          .map((c) => c + c)
          .join("")
      : match[1];
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}
