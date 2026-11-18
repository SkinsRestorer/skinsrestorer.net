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
import {
  HintTrigger,
  ShortcutHints,
} from "@/components/editor/editor-commands";
import {
  editorShortcuts,
  useShortcutHints,
} from "@/components/editor/editor-shortcuts";
import { useT } from "@/lib/i18n-react";

/** The active layer. Tools change only this layer (L switches). */
export function LayerToggle(props: {
  layer: SkinLayer;
  onLayerChange: (layer: SkinLayer) => void;
}) {
  const t = useT();
  const hints = useShortcutHints();
  const hint = t("editor.activeLayer");
  return (
    <>
      <ShortcutHints handle={hints} />
      <ToggleGroup
        aria-label={hint}
        variant="outline"
        size="sm"
        spacing={0}
        value={[props.layer]}
        onValueChange={(value) => {
          if (value[0]) props.onLayerChange(value[0] as SkinLayer);
        }}
      >
        {(["base", "outer"] as const).map((layer) => (
          <HintTrigger
            key={layer}
            hints={hints}
            label={hint}
            commands={["layer"]}
            render={
              <ToggleGroupItem
                value={layer}
                className="pointer-coarse:h-9"
                aria-keyshortcuts={editorShortcuts.layer.join(" ")}
              />
            }
          >
            {t(layer === "base" ? "common.base" : "common.outer")}
          </HintTrigger>
        ))}
      </ToggleGroup>
    </>
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
          {t("editor.visibleParts")}
          {!allShown && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {t("editor.someHidden")}
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 pb-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-1 font-normal">
                    {t("editor.part")}
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    {t("common.base")}
                  </th>
                  <th scope="col" className="pb-1 font-normal">
                    {t("common.outer")}
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
                            {t("editor.showPartLayerLayer", {
                              part: t(skinPartLabels[part]),
                              layer: t(
                                target === "base"
                                  ? "common.base"
                                  : "common.outer",
                              ),
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
              {t("editor.showAll")}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
