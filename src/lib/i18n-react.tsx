import { useAsRef } from "@/hooks/use-as-ref";
import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { Locale } from "./i18n";
import { translate } from "./messages";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useMemo(
    () => (message: string, values?: Record<string, string | number>) =>
      translate(locale, message, values),
    [locale],
  );
}

/** Async notifications use the latest locale without restarting reads or handoffs. */
export function useNotificationT() {
  const current = useAsRef(useT());
  return useCallback(
    (message: string, values?: Record<string, string | number>) =>
      current.current(message, values),
    [current],
  );
}
