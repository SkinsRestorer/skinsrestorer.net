"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CapeStatus } from "@/lib/hooks/use-cape-selection";
import { NO_CAPE_VALUE } from "@/lib/hooks/use-cape-selection";
import type { MineSkinCape } from "@/lib/mineskin";

interface CapeSupportFieldsProps {
  apiKey: string;
  capeStatus: CapeStatus;
  capeOptionsDisabled: boolean;
  supportedCapes: MineSkinCape[];
  selectedCapeUuid: string | null;
  onApiKeyChange: (value: string) => void;
  onCheckCapeAccess: () => void;
  onCapeChange: (value: string | null) => void;
}

export function CapeSupportFields({
  apiKey,
  capeStatus,
  capeOptionsDisabled,
  supportedCapes,
  selectedCapeUuid,
  onApiKeyChange,
  onCheckCapeAccess,
  onCapeChange,
}: CapeSupportFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="mineskin-api-key">MineSkin API key</Label>
        <Input
          id="mineskin-api-key"
          type="password"
          placeholder="Required for cape support"
          value={apiKey}
          onChange={(event) => {
            onApiKeyChange(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={onCheckCapeAccess}
          disabled={capeStatus === "loading"}
        >
          {capeStatus === "loading"
            ? "Checking cape support..."
            : "Check cape access"}
        </Button>
        {capeStatus === "denied" && (
          <p className="text-xs text-muted-foreground">
            Cape support requires an API key with the capes grant.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cape-select">Cape (optional)</Label>
        <Select
          value={selectedCapeUuid ?? undefined}
          onValueChange={(value) => {
            if (value === NO_CAPE_VALUE) {
              onCapeChange(null);
              return;
            }

            onCapeChange(value);
          }}
        >
          <SelectTrigger id="cape-select">
            <SelectValue placeholder="No cape" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CAPE_VALUE}>No cape</SelectItem>
            {supportedCapes.map((cape) => (
              <SelectItem
                key={cape.uuid}
                value={cape.uuid}
                disabled={capeOptionsDisabled}
              >
                {cape.alias}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {capeStatus !== "granted" && (
          <p className="text-xs text-muted-foreground">
            Load cape support with a valid API key to preview and apply capes.
          </p>
        )}
      </div>
    </>
  );
}
