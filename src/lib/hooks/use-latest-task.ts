import { useEffect, useState } from "react";
import { LatestTask } from "../latest-task";

export function useLatestTask() {
  // oxlint-disable-next-line react/hook-use-state -- This value uses lazy initialization and has no setter.
  const [task] = useState(() => new LatestTask());
  useEffect(
    () => () => {
      task.cancel();
    },
    [task],
  );
  return task;
}
