import { useAsRef } from "@/hooks/use-as-ref";
import { createContext, useContext, useMemo, useCallback } from "react";
import type { Locale } from "./i18n";
import {
  createTranslator,
  type Translator,
  type MessageKey,
  type MessageValues,
  type Message,
} from "./messages";

export const LocaleContext = createContext<Locale>("en");

export function useLocale() {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}

/** Async notifications use the latest locale without restarting reads or handoffs. */
export function useNotificationT() {
  const current = useAsRef(useT());
  const translateKey = useCallback(
    (key: MessageKey, values?: MessageValues) => current.current(key, values),
    [current],
  );
  return useMemo<Translator>(
    () =>
      Object.assign(translateKey, {
        message: (value: Message) => current.current.message(value),
        error: (cause: unknown, fallback?: MessageKey) =>
          current.current.error(cause, fallback),
      }),
    [current, translateKey],
  );
}
