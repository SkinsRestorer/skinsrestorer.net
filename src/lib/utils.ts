export { cn } from "cn";

/** Return the option equal to `value`, so a UI string narrows without a cast. */
export function findOption<T extends string>(
  options: readonly T[],
  value: string | undefined,
): T | undefined {
  return options.find((option) => option === value);
}
