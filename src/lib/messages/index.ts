import ru from "./ru.json";
import es from "./es.json";
import ptBR from "./pt-BR.json";
import type { Locale } from "../i18n";

export const catalogs: Record<Exclude<Locale, "en">, Record<string, string>> = {
  ru,
  es,
  "pt-BR": ptBR,
};

/** English messages are stable keys. Unknown service errors keep their detail. */
export function translate(
  locale: Locale,
  message: string,
  values: Record<string, string | number> = {},
): string {
  const prefixed = /^([A-Za-z]+Error): (.+)$/.exec(message);
  if (prefixed)
    return `${prefixed[1]}: ${translate(locale, prefixed[2], values)}`;
  const maximum = /^Maximum (\d+) files allowed$/.exec(message);
  if (maximum)
    return translate(locale, "Maximum {count} files allowed", {
      count: maximum[1],
    });
  const text =
    locale === "en" ? message : (catalogs[locale][message] ?? message);
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    String(values[key] ?? match),
  );
}
