"use client";

import TimeAgo, { type Props } from "react-timeago";
import buildFormatter from "react-timeago/lib/formatters/buildFormatter";
import ru from "react-timeago/lib/language-strings/ru";
import es from "react-timeago/lib/language-strings/es";
import ptBR from "react-timeago/lib/language-strings/pt-br";
import { useLocale } from "@/lib/i18n-react";

const formatters = {
  ru: buildFormatter(ru),
  es: buildFormatter(es),
  "pt-BR": buildFormatter(ptBR),
};

export function CustomTimeAgo(props: Props) {
  const locale = useLocale();
  return (
    <TimeAgo
      formatter={locale === "en" ? undefined : formatters[locale]}
      // The default title is a UTC timestamp. Show the local date and time.
      title={new Date(props.date).toLocaleString(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
      {...props}
    />
  );
}
