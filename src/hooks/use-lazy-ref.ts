import * as React from "react";

function useLazyRef<T>(fn: () => T): React.RefObject<T> {
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [ref] = React.useState(() => ({ current: fn() }));
  return ref;
}

export { useLazyRef };
