import type { ReactNode } from "react";
import type { Locale } from "./i18n";
import { LocaleContext } from "./i18n-react";

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}
