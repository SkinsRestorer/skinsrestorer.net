import { Check, CircleDot, LoaderCircle, SaveOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "saving" | "saved" | "unsaved" | "unavailable";

const icons = {
  saving: LoaderCircle,
  saved: Check,
  unsaved: CircleDot,
  unavailable: SaveOff,
} as const;

/** A quiet save status: an icon whose title and name say the state. */
export function SaveStatus(props: {
  state: SaveState;
  label: string;
  className?: string;
}) {
  const Icon = icons[props.state];
  return (
    <span
      role="img"
      aria-label={props.label}
      title={props.label}
      className={cn(
        "inline-flex shrink-0 text-muted-foreground",
        props.state === "saved" && "text-chart-2",
        props.className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-3.5", props.state === "saving" && "animate-spin")}
      />
    </span>
  );
}
