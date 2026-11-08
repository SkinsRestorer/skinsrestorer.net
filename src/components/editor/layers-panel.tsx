"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import type { SkinVariant } from "@/lib/skin";
import { allPartsVisible, type PartVisibility } from "@/lib/skin-paint";
import { skinPartLabels, skinParts, type SkinLayer } from "@/lib/skin-regions";

export function LayersPanel(props: {
  layer: SkinLayer;
  variant: SkinVariant;
  visibility: PartVisibility;
  onLayerChange: (layer: SkinLayer) => void;
  onVariantChange: (variant: SkinVariant) => void;
  onVisibilityChange: (visibility: PartVisibility) => void;
}) {
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
        <CardTitle>Model and layers</CardTitle>
        <CardDescription>
          Tools only change the active layer on visible parts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle id="editor-model-label">Model</FieldTitle>
            <ToggleGroup
              aria-labelledby="editor-model-label"
              variant="outline"
              spacing={0}
              className="w-full"
              value={[variant]}
              onValueChange={(value) => {
                if (value[0]) props.onVariantChange(value[0] as SkinVariant);
              }}
            >
              <ToggleGroupItem value="classic" className="flex-1">
                Classic, 4 px arms
              </ToggleGroupItem>
              <ToggleGroupItem value="slim" className="flex-1">
                Slim, 3 px arms
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              Changing the model does not move pixels. You can undo it.
            </FieldDescription>
          </Field>
          <Field>
            <FieldTitle id="editor-layer-label">Active layer (L)</FieldTitle>
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
                Base
              </ToggleGroupItem>
              <ToggleGroupItem value="outer" className="flex-1">
                Outer
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <FieldSet>
            <div className="flex items-center justify-between gap-2">
              <FieldLegend variant="label">Visible parts</FieldLegend>
              <Button
                variant="ghost"
                size="sm"
                disabled={allShown}
                onClick={() => props.onVisibilityChange(allPartsVisible())}
              >
                Show all
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="pb-1 font-normal">
                    Part
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    Base
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    Outer
                  </th>
                </tr>
              </thead>
              <tbody>
                {skinParts.map((part) => (
                  <tr key={part}>
                    <th scope="row" className="py-1 text-left font-medium">
                      {skinPartLabels[part]}
                    </th>
                    {(["base", "outer"] as const).map((target) => (
                      <td key={target} className="py-1">
                        <FieldLabel>
                          <Checkbox
                            checked={visibility[part][target]}
                            onCheckedChange={() => toggle(part, target)}
                          />
                          <span className="sr-only">
                            Show {skinPartLabels[part].toLowerCase()} {target}{" "}
                            layer
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
