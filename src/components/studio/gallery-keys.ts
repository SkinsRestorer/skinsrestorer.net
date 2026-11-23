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
  if (target === undefined || target < 0 || target >= count) return undefined;
  return target;
}

/**
 * Move focus between the `button[data-skin-id]` entries of a skin grid with
 * the arrow keys, Home, and End. The column count comes from the grid layout.
 */
export function moveGridFocus(
  event: {
    readonly key: string;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly currentTarget: EventTarget;
    readonly preventDefault: () => void;
  },
  grid: HTMLElement | null,
) {
  if (!grid || event.altKey || event.ctrlKey || event.metaKey) return;
  const buttons = [
    ...grid.querySelectorAll<HTMLButtonElement>("button[data-skin-id]"),
  ];
  const index = buttons.findIndex((button) => button === event.currentTarget);
  if (index < 0) return;
  const columns = getComputedStyle(grid)
    .gridTemplateColumns.split(" ")
    .filter(Boolean).length;
  const target = galleryKeyTarget(
    event.key,
    index,
    buttons.length,
    Math.max(1, columns),
  );
  if (target === undefined) return;
  event.preventDefault();
  buttons[target]?.focus();
}
