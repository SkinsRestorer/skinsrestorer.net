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
      {...props}
    />
  );
}
