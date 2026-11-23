import browserCollections from "fumadocs-mdx:collections/browser";
import { Callout } from "fumadocs-ui/components/callout";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { KeyboardEvent } from "react";
import { DocsLink, PageLinks } from "@/components/docs-link";
import { EnderDashSponsor } from "@/components/enderdash-sponsor";
import { Feedback } from "@/components/feedback";
import { LLMCopyButton, ViewOptions } from "@/components/page-actions";
import type { ResolvedLink } from "@/lib/docs-links";
import type { Locale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/i18n-react";
import { getMDXComponents } from "@/mdx-components";

export interface FooterLink {
  url: string;
  name: string;
  description?: string;
}

export interface DocsPageData {
  path: string;
  url: string;
  links: Record<string, ResolvedLink>;
  contentLocale: Locale;
  neighbours: {
    previous?: FooterLink;
    next?: FooterLink;
  };
}

const mdxComponents = getMDXComponents({ a: DocsLink });

// Format in UTC so the server and the browser render the same date.
function formatReviewedDate(date: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

// The mobile table of contents is a disclosure without Escape handling.
function closeTocPopoverOnEscape(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Escape") return;
  const trigger = event.currentTarget.querySelector<HTMLElement>(
    "[data-toc-popover-trigger][aria-expanded='true']",
  );
  if (!trigger) return;
  event.preventDefault();
  trigger.click();
  trigger.focus();
}

/**
 * Page metadata comes from the live deploy, but the MDX files ship with this
 * tab's JavaScript. A tab opened before a deploy has no file for a page added
 * or translated since then.
 */
export function hasDocsContent(path: string) {
  return `./${path}` in browserCollections.docs.raw;
}

/**
 * The MDX renderer and its page chrome. Only the docs route imports this
 * module, so other pages do not download it.
 */
export const docsClientLoader =
  browserCollections.docs.createClientLoader<DocsPageData>({
    id: "docs-page",
    // fumadocs calls this as a hook (`useRenderer`) inside its page renderer.
    component: function useDocsPageContent(
      { default: MDX, toc, frontmatter },
      page,
    ) {
      const t = useT();
      const locale = useLocale();
      return (
        <DocsPage
          toc={toc}
          full={frontmatter.full}
          // The skip link targets this article, so it must accept focus.
          tabIndex={-1}
          className="outline-none"
          tableOfContent={{
            style: "clerk",
            container: { role: "navigation", "aria-labelledby": "toc-title" },
          }}
          tableOfContentPopover={{
            container: {
              role: "navigation",
              "aria-label": t("common.page"),
              onKeyDown: closeTocPopoverOnEscape,
            },
            trigger: {
              className:
                "focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-inset",
            },
          }}
          footer={{ items: page.neighbours }}
        >
          {page.contentLocale !== locale && (
            <Callout type="info" className="my-0">
              {t("common.pageAvailableEnglish")}
            </Callout>
          )}
          <div className="flex flex-col gap-2">
            <DocsTitle lang={page.contentLocale}>{frontmatter.title}</DocsTitle>
            <DocsDescription lang={page.contentLocale} className="mb-2.5">
              {frontmatter.description}
            </DocsDescription>
            {/* Page facts and actions share one row, so the article starts
                higher. The actions wrap below the facts on narrow screens. */}
            <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b pb-6">
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fd-muted-foreground">
                <span>SkinsRestorer {frontmatter.version}</span>
                <span lang={page.contentLocale}>{frontmatter.appliesTo}</span>
                <span>
                  {t("common.reviewed")}{" "}
                  <time dateTime={frontmatter.reviewed}>
                    {formatReviewedDate(frontmatter.reviewed, locale)}
                  </time>
                </span>
              </p>
              <div className="flex flex-row items-center gap-2">
                <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
                <ViewOptions
                  markdownUrl={`https://skinsrestorer.net${page.url}.mdx`}
                  githubUrl={`https://github.com/SkinsRestorer/skinsrestorer.net/blob/main/content/docs/${page.path}`}
                />
              </div>
            </div>
          </div>
          <DocsBody lang={page.contentLocale}>
            <PageLinks links={page.links}>
              <MDX components={mdxComponents} />
            </PageLinks>
          </DocsBody>
          <Feedback
            key={page.url}
            url={page.url}
            version={frontmatter.version}
          />
          <EnderDashSponsor placement="docs-footer" />
        </DocsPage>
      );
    },
  });
