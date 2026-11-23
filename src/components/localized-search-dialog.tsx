import { useMemo } from "react";
import { useDocsSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { createDocsSearchClient } from "@/lib/docs-search-client";
import { localizePath } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-react";

// Shown before the reader types: the pages most readers come for.
const suggestedPages = [
  ["docs.suggestInstall", "/docs/installation"],
  ["docs.suggestTroubleshooting", "/docs/troubleshooting"],
  ["docs.suggestCommands", "/docs/reference/commands-permissions"],
] as const;

export default function LocalizedSearchDialog(props: SharedProps) {
  const locale = useLocale();
  const t = useT();
  const client = useMemo(() => createDocsSearchClient(locale), [locale]);
  // oxlint-disable-next-line typescript/no-deprecated -- the replacement for custom clients is still experimental_useSearch
  const { search, onSearchChange, isLoading, data, error } = useDocsSearch({
    client,
  });
  const suggestions = useMemo(
    () =>
      suggestedPages.map(([title, path]) => ({
        id: path,
        type: "page" as const,
        content: t(title),
        url: localizePath(path, locale),
      })),
    [locale, t],
  );
  return (
    <SearchDialog
      {...props}
      search={search}
      onSearchChange={onSearchChange}
      isLoading={isLoading}
      {...(data === undefined ? {} : { data })}
      {...(error === undefined ? {} : { error })}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList defaultItems={suggestions} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
