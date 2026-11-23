"use client";

import { useForm } from "@tanstack/react-form";
import { Link2 } from "lucide-react";
import { useId } from "react";
import { LocalizedDialogContent } from "@/components/localized-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useT } from "@/lib/i18n-react";

export function TextureDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (reference: string) => void;
}) {
  const t = useT();
  const id = useId();
  const form = useForm({
    defaultValues: { reference: "" },
    onSubmit: ({ value, formApi }) => {
      props.onOpen(value.reference.trim());
      // The next open starts empty instead of showing the last link.
      formApi.reset();
    },
  });
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <LocalizedDialogContent>
        <form
          // The typed link names a texture; keep it out of session replays.
          className="flex flex-col gap-4 ph-no-capture"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("common.openTextureUrl")}</DialogTitle>
            <DialogDescription>
              {t("studio.texturesMinecraftNetOnly")}
            </DialogDescription>
          </DialogHeader>
          <form.Field name="reference">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={id}>
                  {t("common.textureUrlHash")}
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <Link2 aria-hidden="true" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id={id}
                    value={field.state.value}
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="https://textures.minecraft.net/texture/…"
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    onBlur={field.handleBlur}
                  />
                </InputGroup>
              </Field>
            )}
          </form.Field>
          <DialogFooter>
            <form.Subscribe
              selector={(formState) => formState.values.reference.trim() !== ""}
            >
              {(filled) => (
                <Button type="submit" disabled={!filled}>
                  {t("studio.open")}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </LocalizedDialogContent>
    </Dialog>
  );
}
