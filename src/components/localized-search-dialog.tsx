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
  const { search, setSearch, query } = useDocsSearch({ client });
  return (
    <SearchDialog
      {...props}
      search={search}
      onSearchChange={setSearch}
      isLoading={query.isLoading}
    >
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={query.data === "empty" ? [] : query.data} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
