"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/components/model-selector";
import type { SkinVariant } from "@/lib/skin";
import { allPartsVisible, type PartVisibility } from "@/lib/skin-paint";
import { skinPartLabels, skinParts, type SkinLayer } from "@/lib/skin-regions";
import { useT } from "@/lib/i18n-react";

export function LayersPanel(props: {
  layer: SkinLayer;
  variant: SkinVariant;
  visibility: PartVisibility;
  onLayerChange: (layer: SkinLayer) => void;
  onVariantChange: (variant: SkinVariant) => void;
  onVisibilityChange: (visibility: PartVisibility) => void;
}) {
  const t = useT();
  const { layer, variant, visibility } = props;
  const toggle = (part: (typeof skinParts)[number], target: SkinLayer) =>
    props.onVisibilityChange({
      ...visibility,
      [part]: { ...visibility[part], [target]: !visibility[part][target] },
    });
  const allShown = skinParts.every(
    (part) => visibility[part].base && visibility[part].outer,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Model and layers")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle id="editor-model-label">{t("Model")}</FieldTitle>
            <ModelSelector
              aria-labelledby="editor-model-label"
              value={variant}
              onValueChange={props.onVariantChange}
            />
          </Field>
          <Field>
            <FieldTitle id="editor-layer-label">
              {t("Active layer (L)")}
            </FieldTitle>
            <ToggleGroup
              aria-labelledby="editor-layer-label"
              variant="outline"
              spacing={0}
              className="w-full"
              value={[layer]}
              onValueChange={(value) => {
                if (value[0]) props.onLayerChange(value[0] as SkinLayer);
              }}
            >
              <ToggleGroupItem value="base" className="flex-1">
                {t("Base")}
              </ToggleGroupItem>
              <ToggleGroupItem value="outer" className="flex-1">
                {t("Outer")}
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <FieldSet>
            <div className="flex items-center justify-between gap-2">
              <FieldLegend variant="label">{t("Visible parts")}</FieldLegend>
              <Button
                variant="ghost"
                size="sm"
                disabled={allShown}
                onClick={() => props.onVisibilityChange(allPartsVisible())}
              >
                {t("Show all")}
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
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
                    <th scope="row" className="py-1 text-left font-medium">
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
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
