import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useLinkLocale } from "@/hooks/use-link-locale";
import { hasLocalizedPages, localizeHref } from "@/lib/i18n";
import { getLinkTarget } from "@/lib/link-target";

/** Fumadocs link that keeps the reader's locale and URL fragments. */
export function LocaleLink({
  href = "",
  prefetch = true,
  target,
  children,
  ...props
}: React.ComponentProps<"a"> & { prefetch?: boolean }) {
  // English-only pages link back in the reader's last localized locale.
  const locale = useLinkLocale(
    useRouterState({
      select: (state) => hasLocalizedPages(state.location.pathname),
    }),
  );
  const router = useRouter();
  const targetProps = target === undefined ? {} : { target };
  const link = getLinkTarget(href, locale, router.options);
  // Fragments, relative links, and other sites need no router: the browser
  // resolves them against the current page.
  if (!link)
    return (
      <a href={localizeHref(href, locale)} {...targetProps} {...props}>
        {children}
      </a>
    );
  return (
    <Link
      {...link}
      preload={prefetch ? "intent" : false}
      // Fumadocs sets aria-current itself. Without exact matching, the router
      // would also mark parent pages, such as /docs, as the current page.
      activeOptions={{ exact: true }}
      {...targetProps}
      {...props}
    >
      {children}
    </Link>
  );
}
