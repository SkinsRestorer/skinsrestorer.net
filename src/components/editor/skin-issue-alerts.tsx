"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SkinVariant } from "@/lib/skin";
import type { SkinIssue, SkinIssueId } from "@/lib/skin-check";
import { useT } from "@/lib/i18n-react";

/** One alert per skin problem. Renders nothing when the skin has none. */
export function SkinIssueAlerts(props: {
  issues: readonly SkinIssue[];
  highlighted: SkinIssueId | null;
  onHighlight: (id: SkinIssueId | null) => void;
  onRepair: (id: SkinIssueId) => void;
  onVariant: (variant: SkinVariant) => void;
}) {
  const t = useT();
  const { issues, highlighted } = props;
  if (issues.length === 0) return null;
  return (
    <ul aria-label={t("editor.skinProblems")} className="flex flex-col gap-3">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t(issue.title)}</AlertTitle>
            <AlertDescription className="min-w-0">
              <p>
                {issue.id === "unused-pixels"
                  ? t(issue.detail.key, {
                      ...issue.detail.values,
                      model: t(
                        issue.detail.values?.model === "slim"
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
                  onClick={() => props.onRepair(issue.id)}
                >
                  {t(issue.repair.label)}
                </Button>
              )}
              {issue.switchVariant && (
                <Button
                  size="sm"
                  className="h-auto min-h-8 max-w-full whitespace-normal"
                  variant="outline"
                  onClick={() => props.onVariant(issue.switchVariant!)}
                >
                  {t(
                    issue.switchVariant === "slim"
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
                onClick={() =>
                  props.onHighlight(highlighted === issue.id ? null : issue.id)
                }
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
