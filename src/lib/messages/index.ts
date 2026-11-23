import en from "./en.json";
import type { Locale } from "../i18n";

export type MessageKey = keyof typeof en;
export type MessageValues = Readonly<Record<string, string | number>>;
export type Catalog = Record<MessageKey, string>;

export interface MessageDescriptor {
  readonly key: MessageKey;
  readonly values?: MessageValues | undefined;
}
/** Plain strings are external text, never translation keys. */
export type Message = string | MessageDescriptor;

/**
 * English is the key source and always present. Other catalogs load on
 * demand, so a visitor downloads only the language they read. The server
 * registers every catalog at startup.
 */
const loaded: Partial<Record<Locale, Catalog>> = { en };
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();

const loaders: Record<Exclude<Locale, "en">, () => Promise<Catalog>> = {
  ru: () => import("./ru.json").then((module) => module.default),
  es: () => import("./es.json").then((module) => module.default),
  "pt-BR": () => import("./pt-BR.json").then((module) => module.default),
};

export function registerMessages(locale: Locale, catalog: Catalog) {
  loaded[locale] = catalog;
  for (const listener of listeners) listener();
}

export function hasMessages(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}

/** Load a catalog once. Resolves at once when it is already present. */
export function loadMessages(locale: Locale): Promise<void> {
  if (locale === "en" || hasMessages(locale)) return Promise.resolve();
  let promise = pending.get(locale);
  if (!promise) {
    promise = fetchMessages(locale);
    pending.set(locale, promise);
  }
  return promise;
}

async function fetchMessages(locale: Exclude<Locale, "en">) {
  try {
    registerMessages(locale, await loaders[locale]());
  } catch (cause) {
    // A later navigation may retry, for example after a chunk failure.
    pending.delete(locale);
    throw cause;
  }
}

export function subscribeMessages(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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
  if (!isMessageKey(key))
    throw new Error(`Unknown translation key: ${String(key)}`);
  // A catalog that has not loaded yet falls back to English, never a key.
  const text = (loaded[locale] ?? en)[key];
  return text.replaceAll(/\{(\w+)\}/gu, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

function translateMessage(locale: Locale, value: Message): string {
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

interface LocalizedErrorFields {
  readonly messageKey?: MessageKey;
  readonly messageValues?: MessageValues;
}

// oxlint-disable-next-line effecttsgo/extends-native-error -- This is the base for synchronous UI errors and preserves subclass identity.
export class MessageError extends Error implements LocalizedErrorFields {
  readonly messageKey: MessageKey;
  readonly messageValues?: MessageValues;
  constructor(key: MessageKey, values?: MessageValues) {
    super(translate("en", key, values));
    this.messageKey = key;
    if (values !== undefined) this.messageValues = values;
  }
}

export function isMessageValues(value: unknown): value is MessageValues {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every(
      (item) => typeof item === "string" || typeof item === "number",
    )
  );
}

export function errorMessage(
  cause: unknown,
  fallback: MessageKey = "errors.unexpected",
): Message {
  if (cause && typeof cause === "object") {
    if ("messageKey" in cause && isMessageKey(cause.messageKey)) {
      return message(
        cause.messageKey,
        "messageValues" in cause && isMessageValues(cause.messageValues)
          ? cause.messageValues
          : undefined,
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
