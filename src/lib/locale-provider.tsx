import type { ReactNode } from "react";
import type { Locale } from "./i18n";
import { LocaleContext, useShownLocale } from "./i18n-react";

/** Provide the page locale once its catalog is present. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext value={useShownLocale(locale)}>{children}</LocaleContext>
  );
}
