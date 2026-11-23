import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { deserializePageTree } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { useSidebar } from "fumadocs-ui/layouts/docs/slots/sidebar";
import { useEffect, useMemo } from "react";
import { CookieSettingsButton } from "@/components/cookie-consent-banner";
import type { SerializedDocsTree } from "@/lib/docs-tree";
import { getBaseOptions } from "@/lib/layout-options";
import { isLocale, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";

// The browser reads the prerendered tree file, so docs pages and their
// metadata snapshots do not each carry a copy of the sidebar.
const loadDocsTree = createIsomorphicFn()
  .server(
    async (
      locale: Locale,
      _signal: AbortSignal,
    ): Promise<SerializedDocsTree> => {
      const { serializeDocsTree } = await import("@/lib/source");
      return serializeDocsTree(locale);
    },
  )
  // The build writes this file from serializeDocsTree. Effect loads with
  // the first client navigation, not with every docs page.
  .client(async (locale: Locale, signal: AbortSignal) => {
    const { readDocsTree } = await import("@/lib/docs-tree");
    return readDocsTree(locale, signal);
  });

export const Route = createFileRoute("/{-$lang}/docs")({
  // The tree changes only with a deploy. Load it once per locale and keep the
  // layout mounted while readers move between pages.
  staleTime: Number.POSITIVE_INFINITY,
  loader: ({ params, abortController }) =>
    loadDocsTree(
      isLocale(params.lang) ? params.lang : "en",
      abortController.signal,
    ),
  component: DocsLayoutRoute,
});

function DocsLayoutRoute() {
  const serialized = Route.useLoaderData();
  // Rebuild the tree only when the loader data changes, so the sidebar keeps
  // its identity across renders.
  const pageTree = useMemo(() => deserializePageTree(serialized), [serialized]);
  const locale = useLocale();
  return (
    <DocsLayout
      tree={pageTree}
      {...getBaseOptions(locale)}
      containerProps={{ className: skipLinkClassName }}
      sidebar={{
        footer: (
          <CookieSettingsButton className="self-start px-1 pt-2 text-xs text-fd-muted-foreground hover:text-fd-foreground" />
        ),
      }}
    >
      <SidebarDrawerFocus />
      <Outlet />
    </DocsLayout>
  );
}

// Fumadocs renders an sr-only "Skip to content" link to #nd-page as the
// first child of the layout container. Show it on focus, like the home page.
const skipLinkClassName = [
  "[&>a[href='#nd-page']:focus-visible]:not-sr-only",
  "[&>a[href='#nd-page']:focus-visible]:fixed",
  "[&>a[href='#nd-page']:focus-visible]:top-2",
  "[&>a[href='#nd-page']:focus-visible]:left-2",
  "[&>a[href='#nd-page']:focus-visible]:z-100",
  "[&>a[href='#nd-page']:focus-visible]:rounded-md",
  "[&>a[href='#nd-page']:focus-visible]:bg-background",
  "[&>a[href='#nd-page']:focus-visible]:px-3",
  "[&>a[href='#nd-page']:focus-visible]:py-2",
  "[&>a[href='#nd-page']:focus-visible]:text-sm",
  "[&>a[href='#nd-page']:focus-visible]:text-foreground",
  "[&>a[href='#nd-page']:focus-visible]:ring-2",
  "[&>a[href='#nd-page']:focus-visible]:ring-ring",
  "[&>a[href='#nd-page']:focus-visible]:outline-none",
].join(" ");

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

// The mobile sidebar drawer closes on Escape but leaves focus management to
// the page. While it is open, keep Tab inside it, then return focus to the
// control that opened it.
function SidebarDrawerFocus() {
  const { open, mode } = useSidebar();
  useEffect((): (() => void) | undefined => {
    if (!open || mode !== "drawer") return undefined;
    const drawer = document.querySelector("#nd-sidebar-mobile");
    if (!drawer) return undefined;
    const active = document.activeElement;
    const opener =
      active instanceof HTMLElement && !drawer.contains(active)
        ? active
        : document.querySelector<HTMLElement>(
            "[aria-controls='nd-sidebar-mobile']",
          );
    const focusable = () =>
      [...drawer.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) =>
          !element.closest("[inert]") && element.getClientRects().length > 0,
      );
    focusable()[0]?.focus();

    const trapTab = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      const current = document.activeElement;
      if (!drawer.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapTab);
    return () => {
      document.removeEventListener("keydown", trapTab);
      const current = document.activeElement;
      if (!current || current === document.body || drawer.contains(current)) {
        opener?.focus({ preventScroll: true });
      }
    };
  }, [open, mode]);
  return null;
}
