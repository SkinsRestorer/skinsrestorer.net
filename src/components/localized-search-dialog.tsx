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
import { useLocale } from "@/lib/i18n-react";

export default function LocalizedSearchDialog(props: SharedProps) {
  const locale = useLocale();
  const client = useMemo(() => createDocsSearchClient(locale), [locale]);
  // oxlint-disable-next-line typescript/no-deprecated -- the replacement for custom clients is still experimental_useSearch
  const { search, onSearchChange, isLoading, data, error } = useDocsSearch({
    client,
  });
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
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  );
}
