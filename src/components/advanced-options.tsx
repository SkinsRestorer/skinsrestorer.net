"use client";

import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n-react";
import type { UploadMethod } from "@/lib/studio-options";

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
  return (
    <div className="border-t">
      <Collapsible open={props.open} onOpenChange={props.onOpenChange}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full items-center justify-between gap-3 rounded-md py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
            />
            {t("Advanced options")}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {props.method === "axolotl" ? t("Axolotl") : t("Official")}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pb-1">
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">{t("Upload method")}</FieldLegend>
                <Tabs
                  value={props.method}
                  onValueChange={(value) =>
                    props.onMethodChange(value as UploadMethod)
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="axolotl">{t("Axolotl")}</TabsTrigger>
                    <TabsTrigger value="mineskin">{t("Official")}</TabsTrigger>
                  </TabsList>
                  <TabsContent
                    value="axolotl"
                    className="text-xs text-muted-foreground"
                  >
                    {t(
                      "Use SkinsRestorer Axolotl proxy to upload skins with cape support. This is a free service thanks to a partnership with MineSkin.",
                    )}
                  </TabsContent>
                  <TabsContent
                    value="mineskin"
                    className="text-xs text-muted-foreground"
                  >
                    {t(
                      "Provide a MineSkin API key to upload skins directly with the official MineSkin API.",
                    )}
                  </TabsContent>
                </Tabs>
              </FieldSet>
              {props.method === "mineskin" && props.officialFields}
            </FieldGroup>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
