import { useMatch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import {
  findTreePages,
  readDocsTree,
  type SerializedDocsTree,
} from "@/lib/docs-tree";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";

// Shown before the reader types: the pages most readers come for.
const suggestedPaths = [
  "/docs/installation",
  "/docs/troubleshooting",
  "/docs/reference/commands-permissions",
];

/**
 * The docs layout already holds the tree. Elsewhere, read the prerendered
 * file when the dialog opens.
 */
function useDocsTree(locale: Locale) {
  const layoutTree = useMatch({
    from: "/{-$lang}/docs",
    shouldThrow: false,
  })?.loaderData;
  const [read, setRead] = useState<{
    locale: Locale;
    tree: SerializedDocsTree;
  }>();
  useEffect((): (() => void) | undefined => {
    if (layoutTree) return undefined;
    const controller = new AbortController();
    readDocsTree(locale, controller.signal).then(
      (tree) => {
        setRead({ locale, tree });
      },
      () => {
        // Without the tree, the dialog shows no suggestions.
      },
    );
    return () => {
      controller.abort();
    };
  }, [layoutTree, locale]);
  return layoutTree ?? (read?.locale === locale ? read.tree : undefined);
}

export default function LocalizedSearchDialog(props: SharedProps) {
  const locale = useLocale();
  const client = useMemo(() => createDocsSearchClient(locale), [locale]);
  const tree = useDocsTree(locale);
  // oxlint-disable-next-line typescript/no-deprecated -- the replacement for custom clients is still experimental_useSearch
  const { search, onSearchChange, isLoading, data, error } = useDocsSearch({
    client,
  });
  const suggestions = useMemo(
    () =>
      tree &&
      findTreePages(tree, locale, suggestedPaths).map(({ title, url }) => ({
        id: url,
        type: "page" as const,
        content: title,
        url,
      })),
    [tree, locale],
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
        <SearchDialogList defaultItems={suggestions ?? null} />
      </SearchDialogContent>
    </SearchDialog>
  );
}
