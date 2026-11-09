"use client";

import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { allPartsVisible, type PartVisibility } from "@/lib/skin-paint";
import { skinPartLabels, skinParts, type SkinLayer } from "@/lib/skin-regions";
import { useT } from "@/lib/i18n-react";

/** The active layer. Tools change only this layer (L switches). */
export function LayerToggle(props: {
  layer: SkinLayer;
  onLayerChange: (layer: SkinLayer) => void;
}) {
  const t = useT();
  return (
    <ToggleGroup
      aria-label={t("Active layer (L)")}
      variant="outline"
      size="sm"
      spacing={0}
      value={[props.layer]}
      onValueChange={(value) => {
        if (value[0]) props.onLayerChange(value[0] as SkinLayer);
      }}
    >
      <ToggleGroupItem value="base" aria-keyshortcuts="L">
        {t("Base")}
      </ToggleGroupItem>
      <ToggleGroupItem value="outer" aria-keyshortcuts="L">
        {t("Outer")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Hide parts or layers. Tools do not change hidden parts. Closed by default. */
export function VisibleParts(props: {
  visibility: PartVisibility;
  onVisibilityChange: (visibility: PartVisibility) => void;
}) {
  const t = useT();
  const { visibility } = props;
  const toggle = (part: (typeof skinParts)[number], target: SkinLayer) =>
    props.onVisibilityChange({
      ...visibility,
      [part]: { ...visibility[part], [target]: !visibility[part][target] },
    });
  const allShown = skinParts.every(
    (part) => visibility[part].base && visibility[part].outer,
  );
  return (
    <div className="border-t">
      <Collapsible>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full items-center gap-1.5 rounded-md py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <ChevronRight
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
          />
          {t("Visible parts")}
          {!allShown && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {t("Some hidden")}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 pb-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-1 font-normal">
                    {t("Part")}
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    {t("Base")}
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    {t("Outer")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {skinParts.map((part) => (
                  <tr key={part}>
                    <th scope="row" className="py-1 text-left font-normal">
                      {t(skinPartLabels[part])}
                    </th>
                    {(["base", "outer"] as const).map((target) => (
                      <td key={target} className="py-1">
                        <FieldLabel>
                          <Checkbox
                            checked={visibility[part][target]}
                            onCheckedChange={() => toggle(part, target)}
                          />
                          <span className="sr-only">
                            {t("Show {part}, {layer} layer", {
                              part: t(skinPartLabels[part]),
                              layer: t(target === "base" ? "Base" : "Outer"),
                            })}
                          </span>
                        </FieldLabel>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={allShown}
              onClick={() => props.onVisibilityChange(allPartsVisible())}
            >
              {t("Show all")}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
