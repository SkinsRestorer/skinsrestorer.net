import en from "./en.json";
import ru from "./ru.json";
import es from "./es.json";
import ptBR from "./pt-BR.json";
import type { Locale } from "../i18n";

export type MessageKey = keyof typeof en;
export type MessageValues = Readonly<Record<string, string | number>>;
export interface MessageDescriptor {
  readonly key: MessageKey;
  readonly values?: MessageValues;
}
/** Plain strings are external text, never translation keys. */
export type Message = string | MessageDescriptor;

export const catalogs = { en, ru, es, "pt-BR": ptBR } satisfies Record<
  Locale,
  Record<MessageKey, string>
>;

export function message(
  key: MessageKey,
  values?: MessageValues,
): MessageDescriptor {
  return { key, values };
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  if (!isMessageKey(key)) throw new Error(`Unknown translation key: ${key}`);
  const text = catalogs[locale][key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    String(values[name] ?? match),
  );
}

export function translateMessage(locale: Locale, value: Message): string {
  return typeof value === "string"
    ? value
    : translate(locale, value.key, value.values);
}

/** Keep readable English errors for logs, plus a key for presentation. */
export function messageFields(key: MessageKey, values?: MessageValues) {
  return {
    message: translate("en", key, values),
    messageKey: key,
    messageValues: values,
  };
}

export interface LocalizedErrorFields {
  readonly messageKey?: MessageKey;
  readonly messageValues?: MessageValues;
}

export class MessageError extends Error implements LocalizedErrorFields {
  readonly messageKey: MessageKey;
  readonly messageValues?: MessageValues;
  constructor(key: MessageKey, values?: MessageValues) {
    super(translate("en", key, values));
    this.messageKey = key;
    this.messageValues = values;
  }
}

export function errorMessage(
  cause: unknown,
  fallback: MessageKey = "errors.unexpected",
): Message {
  if (cause && typeof cause === "object") {
    if ("messageKey" in cause && isMessageKey(cause.messageKey)) {
      return message(
        cause.messageKey,
        (cause as LocalizedErrorFields).messageValues,
      );
    }
    if ("message" in cause) return String(cause.message);
  }
  return message(fallback);
}

export function errorFields(cause: unknown, fallback: MessageKey) {
  const detail = errorMessage(cause, fallback);
  return typeof detail === "string"
    ? { message: detail }
    : messageFields(detail.key, detail.values);
}

export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === "string" && Object.hasOwn(en, value);
}

export function createTranslator(locale: Locale) {
  const t = (key: MessageKey, values?: MessageValues) =>
    translate(locale, key, values);
  return Object.assign(t, {
    message: (value: Message) => translateMessage(locale, value),
    error: (cause: unknown, fallback?: MessageKey) =>
      translateMessage(locale, errorMessage(cause, fallback)),
  });
}
export type Translator = ReturnType<typeof createTranslator>;
