"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAsRef } from "@/hooks/use-as-ref";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SkinVariant } from "@/lib/skin";
import type { SkinIssue, SkinIssueId } from "@/lib/skin-check";
import { useT } from "@/lib/i18n-react";

/**
 * One alert per skin problem. Renders nothing when the skin has none.
 *
 * A fix removes its alert, and the focused button with it. Focus then moves
 * to the next alert, or to the owner through `onAllFixed` when none is left.
 */
export function SkinIssueAlerts(props: {
  issues: readonly SkinIssue[];
  highlighted: SkinIssueId | null;
  onHighlight: (id: SkinIssueId | null) => void;
  onRepair: (id: SkinIssueId) => void;
  onVariant: (variant: SkinVariant) => void;
  onAllFixed?: () => void;
}) {
  const t = useT();
  const { issues, highlighted } = props;
  const items = useRef(new Map<SkinIssueId, HTMLLIElement>());
  // The issue whose fix button had focus, and the alerts after and before it.
  const pending = useRef<{
    from: SkinIssueId;
    next: readonly SkinIssueId[];
  } | null>(null);
  const onAllFixed = useAsRef(props.onAllFixed);

  useEffect(() => {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    if (issues.some((issue) => issue.id === request.from)) return;
    // Leave focus alone if it is still somewhere on the page.
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const target = request.next.find((id) => items.current.has(id));
    if (target === undefined) onAllFixed.current?.();
    else items.current.get(target)?.querySelector("button")?.focus();
  }, [issues, onAllFixed]);

  const fix = (id: SkinIssueId, action: () => void) => {
    const index = issues.findIndex((issue) => issue.id === id);
    pending.current = {
      from: id,
      next: [
        ...issues.slice(index + 1),
        ...issues.slice(0, index).toReversed(),
      ].map((issue) => issue.id),
    };
    action();
  };

  if (issues.length === 0) return null;
  return (
    <ul aria-label={t("editor.skinProblems")} className="flex flex-col gap-3">
      {issues.map(({ switchVariant, ...issue }) => (
        <li
          key={issue.id}
          ref={(element) => {
            if (element) items.current.set(issue.id, element);
            else items.current.delete(issue.id);
          }}
        >
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t(issue.title)}</AlertTitle>
            <AlertDescription className="min-w-0">
              <p>
                {issue.id === "unused-pixels"
                  ? t(issue.detail.key, {
                      ...issue.detail.values,
                      model: t(
                        issue.detail.values?.["model"] === "slim"
                          ? "model.slim"
                          : "model.classic",
                      ),
                    })
                  : t.message(issue.detail)}
              </p>
            </AlertDescription>
            <div className="col-span-full mt-2 flex min-w-0 flex-wrap gap-2">
              {issue.repair && (
                <Button
                  size="sm"
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  onClick={() => {
                    fix(issue.id, () => {
                      props.onRepair(issue.id);
                    });
                  }}
                >
                  {t(issue.repair.label)}
                </Button>
              )}
              {switchVariant && (
                <Button
                  size="sm"
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  variant="outline"
                  onClick={() => {
                    fix(issue.id, () => {
                      props.onVariant(switchVariant);
                    });
                  }}
                >
                  {t(
                    switchVariant === "slim"
                      ? "editor.useSlim"
                      : "editor.useClassic",
                  )}
                </Button>
              )}
              <Button
                size="sm"
                className="h-auto min-h-8 max-w-full whitespace-normal"
                variant="ghost"
                aria-pressed={highlighted === issue.id}
                onClick={() => {
                  props.onHighlight(highlighted === issue.id ? null : issue.id);
                }}
              >
                {t("editor.showPixels")}
              </Button>
            </div>
          </Alert>
        </li>
      ))}
    </ul>
  );
}
