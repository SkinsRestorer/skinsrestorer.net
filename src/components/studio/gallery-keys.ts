/** The item index an arrow, Home, or End key moves to in a grid. */
export function galleryKeyTarget(
  key: string,
  index: number,
  count: number,
  columns: number,
): number | undefined {
  const target =
    key === "ArrowRight"
      ? index + 1
      : key === "ArrowLeft"
        ? index - 1
        : key === "ArrowDown"
          ? index + columns
          : key === "ArrowUp"
            ? index - columns
            : key === "Home"
              ? 0
              : key === "End"
                ? count - 1
                : undefined;
  if (target === undefined || target < 0 || target >= count) return;
  return target;
}
