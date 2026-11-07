import { useEffect, useState } from "react";
import { LatestTask } from "../latest-task";

export function useLatestTask() {
  const [task] = useState(() => new LatestTask());
  useEffect(() => () => task.cancel(), [task]);
  return task;
}
