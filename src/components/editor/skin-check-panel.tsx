"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SkinVariant } from "@/lib/skin";
import type { SkinIssue, SkinIssueId } from "@/lib/skin-check";

export function SkinCheckPanel(props: {
  issues: readonly SkinIssue[];
  legacy: boolean;
  highlighted: SkinIssueId | null;
  onHighlight: (id: SkinIssueId | null) => void;
  onRepair: (id: SkinIssueId) => void;
  onVariant: (variant: SkinVariant) => void;
}) {
  const { issues, highlighted } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            Skin check
            {issues.length > 0 && (
              <Badge variant="secondary">{issues.length}</Badge>
            )}
          </span>
        </CardTitle>
        <CardDescription>
          Problems that change how the skin looks in Java Edition. Nothing
          changes until you choose a fix, and every fix can be undone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {props.legacy && (
          <Alert>
            <AlertTitle>Converted from 64×32</AlertTitle>
            <AlertDescription>
              This skin used the old layout. The left arm and left leg now copy
              the right ones, as the game does.
            </AlertDescription>
          </Alert>
        )}
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden="true" />
            No problems found.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {issues.map((issue) => (
              <li key={issue.id}>
                <Alert>
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>{issue.title}</AlertTitle>
                  <AlertDescription>
                    <p>{issue.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {issue.repair && (
                        <Button
                          size="sm"
                          onClick={() => props.onRepair(issue.id)}
                        >
                          {issue.repair.label}
                        </Button>
                      )}
                      {issue.switchVariant && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => props.onVariant(issue.switchVariant!)}
                        >
                          Use the {issue.switchVariant} model
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
        )}
      </CardContent>
    </Card>
  );
}
