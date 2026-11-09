import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n-react";

/** Compose the existing dialog with a translated accessible close control. */
export function LocalizedDialogContent({
  children,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const t = useT();
  return (
    <DialogContent {...props} showCloseButton={false}>
      {children}
      <DialogClose
        render={
          <Button
            variant="ghost"
            className="absolute top-2 right-2"
            size="icon-sm"
            aria-label={t("Close")}
          />
        }
      >
        <XIcon />
      </DialogClose>
    </DialogContent>
  );
}
