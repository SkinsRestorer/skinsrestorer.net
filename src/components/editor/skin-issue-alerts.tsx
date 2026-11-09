"use client";

import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { SkinVariant } from "@/lib/skin";
import type { SkinIssue, SkinIssueId } from "@/lib/skin-check";

/** One alert per skin problem. Renders nothing when the skin has none. */
export function SkinIssueAlerts(props: {
  issues: readonly SkinIssue[];
  highlighted: SkinIssueId | null;
  onHighlight: (id: SkinIssueId | null) => void;
  onRepair: (id: SkinIssueId) => void;
  onVariant: (variant: SkinVariant) => void;
}) {
  const { issues, highlighted } = props;
  if (issues.length === 0) return null;
  return (
    <ul aria-label="Skin problems" className="flex flex-col gap-3">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Alert>
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>{issue.title}</AlertTitle>
            <AlertDescription>
              <p>{issue.detail}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {issue.repair && (
                  <Button size="sm" onClick={() => props.onRepair(issue.id)}>
                    {issue.repair.label}
                  </Button>
                )}
                {issue.switchVariant && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => props.onVariant(issue.switchVariant!)}
                  >
                    Use {issue.switchVariant}
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
                  Show pixels
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </li>
      ))}
    </ul>
  );
}
