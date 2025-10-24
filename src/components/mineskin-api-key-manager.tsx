"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MineSkinApiKeyManagerProps = {
  apiKey: string | null;
  onSave: (apiKey: string) => void;
  onClear: () => void;
  hasCapesGrant: boolean;
  loadingGrants: boolean;
  grantsError: string | null;
  onRefreshGrants: () => void;
};

export function MineSkinApiKeyManager({
  apiKey,
  onSave,
  onClear,
  hasCapesGrant,
  loadingGrants,
  grantsError,
  onRefreshGrants,
}: MineSkinApiKeyManagerProps) {
  const [inputValue, setInputValue] = useState(apiKey ?? "");

  useEffect(() => {
    setInputValue(apiKey ?? "");
  }, [apiKey]);

  return (
    <div className="space-y-2">
      <Label htmlFor="mineskin-api-key">MineSkin API key</Label>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = inputValue.trim();

          if (trimmed.length === 0) {
            toast.error("Enter an API key or use Clear to remove it.");
            return;
          }

          onSave(trimmed);
          toast.success("API key saved locally.");
        }}
      >
        <Input
          id="mineskin-api-key"
          autoComplete="off"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Paste your MineSkin API key"
        />
        <div className="flex gap-2 sm:w-auto">
          <Button type="submit" className="flex-1 sm:flex-initial">
            Save key
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClear();
              setInputValue("");
              toast.success("Cleared stored API key.");
            }}
            className="flex-1 sm:flex-initial"
            disabled={!apiKey}
          >
            Clear
          </Button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        API keys are stored in this browser via localStorage. Create keys at{" "}
        <a
          href="https://account.mineskin.org/keys"
          target="_blank"
          rel="noreferrer noopener"
          className="underline"
        >
          account.mineskin.org/keys
        </a>
        .
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">Capes grant:</span>
        <span>
          {loadingGrants
            ? "Checking..."
            : hasCapesGrant
              ? "Granted"
              : "Not available"}
        </span>
        {apiKey && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => {
              onRefreshGrants();
              toast("Refreshing grant information...");
            }}
          >
            Refresh status
          </Button>
        )}
      </div>
      {grantsError && (
        <p className="text-xs text-destructive">
          Failed to load grant information: {grantsError}
        </p>
      )}
    </div>
  );
}

