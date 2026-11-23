import { Link, useRouter } from "@tanstack/react-router";
import { useLocale } from "@/lib/i18n-react";
import { getLinkTarget } from "@/lib/link-target";

/** Fumadocs link that keeps the reader's locale and URL fragments. */
export function LocaleLink({
  href = "",
  prefetch = true,
  target,
  children,
  ...props
}: React.ComponentProps<"a"> & { prefetch?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const targetProps = target === undefined ? {} : { target };
  // A fragment link stays on the current page, so the router has nothing to do.
  if (href.startsWith("#"))
    return (
      <a href={href} {...targetProps} {...props}>
        {children}
      </a>
    );
  const link = getLinkTarget(href, locale, router.options.parseSearch);
  return (
    <Link
      {...(link ?? { to: href })}
      preload={prefetch ? "intent" : false}
      {...targetProps}
      {...props}
    >
      {children}
    </Link>
  );
}
