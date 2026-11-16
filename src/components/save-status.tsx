import { Check, CircleDot, LoaderCircle, SaveOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveState = "saving" | "saved" | "unsaved" | "unavailable";

const icons = {
  saving: LoaderCircle,
  saved: Check,
  unsaved: CircleDot,
  unavailable: SaveOff,
} as const;

/**
 * A quiet save status: an icon with the state as a title. It is a polite
 * live region, so screen readers announce a new state.
 */
export function SaveStatus(props: {
  state: SaveState;
  label: string;
  className?: string;
}) {
  const Icon = icons[props.state];
  return (
    <output
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
      <span className="sr-only">{props.label}</span>
    </output>
  );
}
