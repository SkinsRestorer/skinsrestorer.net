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
    <ul aria-label={t("Skin problems")} className="flex flex-col gap-3">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{t(issue.title)}</AlertTitle>
            <AlertDescription>
              <p>
                {issue.id === "transparent-base"
                  ? t(
                      "{count} base pixels are not opaque. The game shows them opaque.",
                      { count: issue.pixels.length },
                    )
                  : issue.id === "unused-pixels"
                    ? t(
                        "{count} pixels are outside the {model} model. The game ignores them.",
                        {
                          count: issue.pixels.length,
                          model: t(
                            issue.detail.includes("slim")
                              ? t("Slim")
                              : t("Classic"),
                          ),
                        },
                      )
                    : t(issue.detail)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {issue.repair && (
                  <Button size="sm" onClick={() => props.onRepair(issue.id)}>
                    {t(issue.repair.label)}
                  </Button>
                )}
                {issue.switchVariant && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => props.onVariant(issue.switchVariant!)}
                  >
                    {t(
                      issue.switchVariant === "slim"
                        ? "Use slim"
                        : "Use classic",
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-pressed={highlighted === issue.id}
                  onClick={() =>
                    props.onHighlight(
                      highlighted === issue.id ? null : issue.id,
                    )
                  }
                >
                  {t("Show pixels")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </li>
      ))}
    </ul>
  );
}
