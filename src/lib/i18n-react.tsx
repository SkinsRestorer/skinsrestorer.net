import { useAsRef } from "@/hooks/use-as-ref";
import {
  cloneElement,
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Locale } from "./i18n";
import {
  createTranslator,
  hasMessages,
  loadMessages,
  subscribeMessages,
  translate,
  type Translator,
  type MessageKey,
  type MessageValues,
  type Message,
} from "./messages";
import type { RichMessageKey, RichMessageValues } from "./rich-messages";

export const LocaleContext = createContext<Locale>("en");

export function useLocale() {
  return useContext(LocaleContext);
}

/**
 * The locale to show for the URL's locale. The router changes the URL before
 * the root route has loaded the new catalog. Until the catalog arrives, the
 * previous language stays, so text never flashes in English. Use it for all
 * text that follows the URL, including the document language.
 */
export function useShownLocale(locale: Locale): Locale {
  const ready = useSyncExternalStore(
    subscribeMessages,
    () => hasMessages(locale),
    () => hasMessages(locale),
  );
  const [shown, setShown] = useState(locale);
  if (ready && shown !== locale) setShown(locale);
  useEffect(() => {
    // Navigation retries a failed load, so this request may fail quietly.
    if (!ready) loadMessages(locale).catch(() => undefined);
  }, [locale, ready]);
  return ready ? locale : shown;
}

/**
 * Values for a rich message. A `<tag>text</tag>` takes an element, which
 * gets the tag's text as its children. A `{name}` placeholder takes any node.
 */
export type RichValues = Readonly<Record<string, ReactNode>>;

type RichNode =
  | string
  | { readonly placeholder: string }
  | { readonly tag: string; readonly children: readonly RichNode[] };

interface RichFrame {
  readonly tag: string;
  readonly raw: string;
  readonly children: RichNode[];
  readonly parent?: RichFrame;
}

const richToken = /<(\w+)>|<\/(\w+)>|\{(\w+)\}/gu;

/** Unmatched tags stay as literal text, so a typo never drops words. */
function parseRich(text: string): readonly RichNode[] {
  let current: RichFrame = { tag: "", raw: "", children: [] };
  let last = 0;
  for (const match of text.matchAll(richToken)) {
    const [raw, open, close, placeholder] = match;
    if (match.index > last)
      current.children.push(text.slice(last, match.index));
    last = match.index + raw.length;
    if (open !== undefined) {
      current = { tag: open, raw, children: [], parent: current };
    } else if (close !== undefined) {
      if (current.parent && close === current.tag) {
        current.parent.children.push({
          tag: current.tag,
          children: current.children,
        });
        current = current.parent;
      } else current.children.push(raw);
    } else if (placeholder !== undefined)
      current.children.push({ placeholder });
  }
  if (last < text.length) current.children.push(text.slice(last));
  while (current.parent) {
    current.parent.children.push(current.raw, ...current.children);
    current = current.parent;
  }
  return current.children;
}

function renderRich(nodes: readonly RichNode[], values: RichValues): ReactNode {
  const rendered = nodes.map((node): ReactNode => {
    if (typeof node === "string") return node;
    if ("placeholder" in node) {
      const value = Object.hasOwn(values, node.placeholder)
        ? values[node.placeholder]
        : undefined;
      return value === undefined ? `{${node.placeholder}}` : value;
    }
    const chunks = renderRich(node.children, values);
    const wrapper = Object.hasOwn(values, node.tag)
      ? values[node.tag]
      : undefined;
    return isValidElement(wrapper)
      ? cloneElement(wrapper, undefined, chunks)
      : chunks;
  });
  if (rendered.length === 1) return rendered[0];
  // Spread children are positional, so they need no keys.
  return createElement(Fragment, null, ...rendered);
}

/**
 * Format a message with `<tag>text</tag>` markup and `{name}` placeholders.
 * A tag without a value renders its text without a wrapper.
 */
export function formatRich(text: string, values: RichValues = {}): ReactNode {
  return renderRich(parseRich(text), values);
}

export function createRichTranslator(locale: Locale) {
  return Object.assign(createTranslator(locale), {
    rich: <K extends RichMessageKey>(key: K, values: RichMessageValues<K>) =>
      formatRich(translate(locale, key), values),
  });
}

export function useT() {
  const locale = useLocale();
  return useMemo(() => createRichTranslator(locale), [locale]);
}

/** Async notifications use the latest locale without restarting reads. */
export function useNotificationT() {
  const current = useAsRef(useT());
  return useMemo<Translator>(
    () =>
      Object.assign(
        (key: MessageKey, values?: MessageValues) =>
          current.current(key, values),
        {
          message: (value: Message) => current.current.message(value),
          error: (cause: unknown, fallback?: MessageKey) =>
            current.current.error(cause, fallback),
        },
      ),
    [current],
  );
}
