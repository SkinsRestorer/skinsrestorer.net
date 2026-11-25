import { useMatch } from "@tanstack/react-router";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/reactivity";
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
import {
  findTreePages,
  readDocsTree,
  type SerializedDocsTree,
} from "@/lib/docs-tree";
import type { Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";
import { abortable } from "@/lib/latest-effect";

// Shown before the reader types: the pages most readers come for.
const suggestedPaths = [
  "/docs/installation",
  "/docs/troubleshooting",
  "/docs/reference/commands-permissions",
];

type TreeResult = AsyncResult.AsyncResult<SerializedDocsTree, unknown>;

/**
 * The prerendered tree of one locale. Closing the dialog or switching the
 * locale interrupts the read. The server renders it as loading.
 */
const docsTreeAtom = Atom.family((locale: Locale) =>
  Atom.make(abortable((signal) => readDocsTree(locale, signal))).pipe(
    Atom.withServerValueInitial,
  ),
);

const noTreeAtom = Atom.readable((): TreeResult => AsyncResult.initial());

/**
 * The docs layout already holds the tree. Elsewhere, read the prerendered
 * file when the dialog opens.
 */
function useDocsTree(locale: Locale) {
  const layoutTree = useMatch({
    from: "/{-$lang}/docs",
    shouldThrow: false,
  })?.loaderData;
  const atom: Atom.Atom<TreeResult> = layoutTree
    ? noTreeAtom
    : docsTreeAtom(locale);
  const result = useAtomValue(atom);
  // Without the tree, the dialog shows no suggestions.
  return (
    layoutTree ?? (AsyncResult.isSuccess(result) ? result.value : undefined)
  );
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
