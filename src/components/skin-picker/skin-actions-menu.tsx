"use client";

import {
  Copy,
  Download,
  Ellipsis,
  PencilLine,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  downloadSkin,
  skinChanged,
  type SkinLibraryActions,
} from "@/lib/hooks/use-skin-library";
import { MAX_SKIN_NAME_LENGTH, type StoredSkin } from "@/lib/skin-library";

/**
 * Actions for one kept skin. Without `skin`, only the actions that work on
 * the form's own copy are shown.
 */
export function SkinActionsMenu(props: {
  skin?: StoredSkin;
  file?: File;
  name: string;
  actions: SkinLibraryActions;
  onUse?: () => void;
  onClear?: () => void;
  onRemoved?: () => void;
  onReverted?: (skin: StoredSkin) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const { skin, actions } = props;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${props.name}`}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {props.onUse && (
              <DropdownMenuItem onClick={props.onUse}>
                Use this skin
              </DropdownMenuItem>
            )}
            {skin && (
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <PencilLine />
                Rename
              </DropdownMenuItem>
            )}
            {skin && (
              <DropdownMenuItem onClick={() => void actions.duplicate(skin.id)}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
            )}
            {(skin || props.file) && (
              <DropdownMenuItem
                onClick={() =>
                  downloadSkin(skin?.current.png ?? props.file!, props.name)
                }
              >
                <Download />
                Download PNG
              </DropdownMenuItem>
            )}
            {skin && skinChanged(skin) && (
              <DropdownMenuItem
                onClick={() =>
                  void actions.revert(skin.id).then((reverted) => {
                    if (reverted) props.onReverted?.(reverted);
                  })
                }
              >
                <RotateCcw />
                Revert to original
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {(skin || props.onClear) && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            {props.onClear && (
              <DropdownMenuItem onClick={props.onClear}>
                <X />
                Clear selection
              </DropdownMenuItem>
            )}
            {skin && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  void actions.remove(skin.id).then(() => props.onRemoved?.())
                }
              >
                <Trash2 />
                Remove from this browser
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {skin && (
        <RenameDialog
          open={renaming}
          name={skin.name}
          onOpenChange={setRenaming}
          onRename={(name) => void actions.rename(skin.id, name)}
        />
      )}
    </>
  );
}

function RenameDialog(props: {
  open: boolean;
  name: string;
  onOpenChange: (open: boolean) => void;
  onRename: (name: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(props.name);
  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (open) setValue(props.name);
        props.onOpenChange(open);
      }}
    >
      <DialogContent>
        <form
          className="ph-no-capture flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) props.onRename(value);
            props.onOpenChange(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename skin</DialogTitle>
            <DialogDescription>
              The name is kept in this browser only.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={id}>Name</FieldLabel>
            <Input
              id={id}
              value={value}
              maxLength={MAX_SKIN_NAME_LENGTH}
              autoComplete="off"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
