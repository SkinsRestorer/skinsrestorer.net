"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PartVisibility } from "@/lib/skin-paint";
import { skinPartLabels, skinParts, type SkinLayer } from "@/lib/skin-regions";
import { partCopies, type PartAction } from "@/lib/skin-transform";
import { useT } from "@/lib/i18n-react";

const copyLabels: Record<string, string> = {
  "rightArm leftArm": "Right arm to left arm",
  "leftArm rightArm": "Left arm to right arm",
  "rightLeg leftLeg": "Right leg to left leg",
  "leftLeg rightLeg": "Left leg to right leg",
};

/**
 * Flip a part or copy an arm or leg on the active layer. A hidden target
 * part cannot change, so its item is off.
 */
export function PartActions(props: {
  layer: SkinLayer;
  visibility: PartVisibility;
  onAction: (action: PartAction) => void;
}) {
  const t = useT();
  const { layer, visibility } = props;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-auto min-h-8 max-w-full self-start text-left whitespace-normal"
          />
        }
      >
        {t("Flip or copy a part")}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("Flip left to right, {layer}", {
              layer: t(layer === "base" ? "base layer" : "outer layer"),
            })}
          </DropdownMenuLabel>
          {skinParts.map((part) => (
            <DropdownMenuItem
              key={part}
              disabled={!visibility[part][layer]}
              onClick={() => props.onAction({ kind: "flip", part })}
            >
              {t(skinPartLabels[part])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("Copy without mirroring, {layer}", {
              layer: t(layer === "base" ? "base layer" : "outer layer"),
            })}
          </DropdownMenuLabel>
          {partCopies.map(({ from, to }) => (
            <DropdownMenuItem
              key={`${from} ${to}`}
              disabled={!visibility[to][layer]}
              onClick={() => props.onAction({ kind: "copy", from, to })}
            >
              {t(copyLabels[`${from} ${to}`])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
