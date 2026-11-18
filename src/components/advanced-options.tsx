"use client";

import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useT } from "@/lib/i18n-react";
import type { UploadMethod } from "@/lib/studio-options";
import { findOption } from "@/lib/utils";

/** Labels wrap in the narrow options column instead of overflowing. */
const wrappingToggle =
  "h-auto min-h-8 w-full min-w-0 text-center whitespace-normal";

/**
 * The upload method and the optional MineSkin key, closed by default. The
 * Studio owns the open state, so it stays open while the user edits the
 * skin or changes other options.
 */
export function AdvancedOptions(props: {
  method: UploadMethod;
  onMethodChange: (method: UploadMethod) => void;
  /** Fields for the Official method, such as the API key. */
  officialFields: ReactNode;
  /** Controlled open state, for example to show the key field on request. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  return (
    <div className="border-t">
      <Collapsible open={props.open} onOpenChange={props.onOpenChange}>
        <CollapsibleTrigger
          render={
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- The trigger's children become this button's content and label.
            <button
              type="button"
              className="group flex w-full items-center justify-between gap-3 rounded-md py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none"
            />
            {t("common.advancedOptions")}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {props.method === "axolotl" ? "Axolotl" : t("common.official")}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-1">
            <FieldGroup>
              {/* The toggle group is the only group, named by this title. */}
              <div className="flex flex-col gap-2">
                <FieldTitle id={titleId}>{t("common.uploadMethod")}</FieldTitle>
                {/* A form choice, not navigation: a toggle group, not tabs. */}
                <ToggleGroup
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                  variant="outline"
                  spacing={0}
                  className="grid w-full grid-cols-2"
                  value={[props.method]}
                  onValueChange={(value) => {
                    const method = findOption(
                      ["axolotl", "mineskin"],
                      value[0],
                    );
                    if (method) props.onMethodChange(method);
                  }}
                >
                  <ToggleGroupItem value="axolotl" className={wrappingToggle}>
                    <span className="py-1">{"Axolotl"}</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="mineskin" className={wrappingToggle}>
                    <span className="py-1">{t("common.official")}</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription id={descriptionId}>
                  {props.method === "axolotl"
                    ? t("common.useSkinsrestorerAxolotlProxyUploadSkinsCape")
                    : t("common.provideMineskinApiKeyUploadSkinsDirectly")}
                </FieldDescription>
              </div>
              {props.method === "mineskin" && props.officialFields}
            </FieldGroup>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
