import type { ComponentProps } from "react";
import { useT } from "@/lib/i18n-react";

/**
 * Like the Fumadocs table, but horizontal swipes inside a wide table do not
 * trigger browser back and forward gestures. Keyboard users focus the named
 * region to scroll it.
 */
export function DocsTable(props: ComponentProps<"table">) {
  const t = useT();
  return (
    <section
      aria-label={t("docs.scrollableTable")}
      className="relative my-6 prose-no-margin overflow-auto overscroll-x-contain"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll wide tables.
      tabIndex={0}
    >
      <table {...props} />
    </section>
  );
}
