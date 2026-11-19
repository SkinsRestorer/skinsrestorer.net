export { cn } from "cn";

/** Return the option equal to `value`, so a UI string narrows without a cast. */
export function findOption<T extends string>(
  options: readonly T[],
  value: unknown,
): T | undefined {
  return options.find((option) => option === value);
}

/**
 * Return `value`, or throw when it is missing. Use it where a lookup cannot
 * miss unless the code around it is wrong.
 */
export function required<T>(
  value: T | null | undefined,
  description: string,
): T {
  if (value == null) throw new Error(`Missing ${description}`);
  return value;
}
