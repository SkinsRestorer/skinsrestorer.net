import { useRouter, useRouterState } from "@tanstack/react-router";
import { analytics } from "@/lib/analytics";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  browserStorage,
  hasLocalizedPages,
  localizePath,
  rememberLocale,
} from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";
import {
  languageOffer,
  pageHasLocale,
  recordLanguageAnswer,
  type LanguageAnswer,
} from "@/lib/language-suggestion";
import { hasMessages, loadMessages, translate } from "@/lib/messages";

/**
 * Offer the page in the browser's language when the site has it. Many
 * visitors land on English pages and rely on browser translation, which also
 * breaks hydration. The offer shows once: switching, dismissing, letting it
 * close, or picking a language in the switcher all count as an answer. A
 * visitor who lands on a page without a translation gets the offer on the
 * first translated page they open.
 */
export function LanguageSuggestion() {
  const locale = useLocale();
  const router = useRouter();
  const localized = useRouterState({
    select: (state) => hasLocalizedPages(state.location.pathname),
  });
  // English-only pages, such as legal text, link back in this locale.
  useEffect(() => {
    if (localized) rememberLocale(browserStorage(), locale);
  }, [locale, localized]);
  useEffect((): (() => void) | undefined => {
    const storage = browserStorage();
    const target = languageOffer(storage, navigator.languages, locale);
    if (!target) return undefined;
    const available = () =>
      pageHasLocale(router.state.location.href, target, router.state.matches);
    // Only the visitor's first answer counts; cleanup's own dismiss does not.
    let settled = false;
    let shown: { id: string | number; withdraw: () => void } | undefined;
    const answer = (outcome: LanguageAnswer) => {
      if (settled) return;
      settled = true;
      recordLanguageAnswer(storage, outcome);
      void analytics.capture("language_suggestion", {
        from: locale,
        to: target,
        outcome,
      });
    };
    const show = () => {
      // Withdrawing the offer on an untranslated page is not an answer.
      let withdrawn = false;
      const respond = (outcome: LanguageAnswer) => {
        if (!withdrawn) answer(outcome);
      };
      const id = toast(
        <span lang={target}>
          {translate(target, "common.languageSuggestion")}
        </span>,
        {
          position: "top-center",
          duration: 12_000,
          closeButton: true,
          action: {
            label: (
              <span lang={target}>
                {translate(target, "common.languageSuggestionAction")}
              </span>
            ),
            onClick: () => {
              respond("switched");
              // The toast outlives navigation, so switch the page open now.
              void router.navigate({
                href: localizePath(router.state.location.href, target),
              });
            },
          },
          onDismiss: () => {
            respond("dismissed");
          },
          onAutoClose: () => {
            respond("ignored");
          },
        },
      );
      return {
        id,
        withdraw: () => {
          withdrawn = true;
          toast.dismiss(id);
        },
      };
    };
    const update = () => {
      if (settled) return;
      if (!available()) {
        shown?.withdraw();
        shown = undefined;
      } else if (hasMessages(target)) shown ??= show();
    };
    update();
    // The offer is in the target language, so it waits for that catalog.
    loadMessages(target).then(update, () => undefined);
    const unsubscribe = router.subscribe("onResolved", update);
    return () => {
      unsubscribe();
      settled = true;
      if (shown) toast.dismiss(shown.id);
    };
  }, [locale, router]);
  return null;
}
