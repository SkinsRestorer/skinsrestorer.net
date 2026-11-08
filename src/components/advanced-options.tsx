"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type UploadMethod = "axolotl" | "mineskin";

/**
 * The upload method and the optional MineSkin key, closed by default. It
 * stays mounted, so it keeps its open state while the user edits the skin
 * or changes other options.
 */
export function AdvancedOptions(props: {
  method: UploadMethod;
  onMethodChange: (method: UploadMethod) => void;
  /** Fields for the Official method, such as the API key. */
  officialFields: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="group flex w-full items-center justify-between gap-3 rounded-md py-3 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="flex items-center gap-1.5">
            <ChevronRight
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90 motion-reduce:transition-none"
            />
            Advanced options
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {props.method === "axolotl"
              ? "Axolotl (default)"
              : "Official MineSkin"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 pb-1">
            <div className="flex flex-col gap-2">
              <Label>Upload method</Label>
              <Tabs
                value={props.method}
                onValueChange={(value) =>
                  props.onMethodChange(value as UploadMethod)
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="axolotl">Axolotl</TabsTrigger>
                  <TabsTrigger value="mineskin">Official</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="axolotl"
                  className="text-xs text-muted-foreground"
                >
                  Use SkinsRestorer Axolotl proxy to upload skins with cape
                  support. This is a free service thanks to a partnership with
                  MineSkin.
                </TabsContent>
                <TabsContent
                  value="mineskin"
                  className="text-xs text-muted-foreground"
                >
                  Provide a MineSkin API key to upload skins directly with the
                  official MineSkin API.
                </TabsContent>
              </Tabs>
            </div>
            {props.method === "mineskin" && props.officialFields}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
