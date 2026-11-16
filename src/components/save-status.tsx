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
 * A quiet save status: an icon and the state as short text. Long text
 * truncates, and the title keeps the full text. It is a polite live
 * region, so screen readers announce a new state.
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
        "inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground",
        props.className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0",
          // Small green text fails contrast, so only the icon is green.
          props.state === "saved" && "text-chart-2",
          props.state === "saving" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className="truncate">{props.label}</span>
    </output>
  );
}
