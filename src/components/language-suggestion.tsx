import { useRouter } from "@tanstack/react-router";
import { posthog } from "posthog-js";
import { useEffect } from "react";
import { toast } from "sonner";
import { localizePath } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";
import { pageHasLocale, suggestedLocale } from "@/lib/language-suggestion";
import { translate } from "@/lib/messages";

const answeredKey = "skinsrestorer:language-suggestion";

/**
 * Offer the page in the browser's language when the site has it. Many
 * visitors land on English pages and rely on browser translation, which also
 * breaks hydration. The offer shows once: switching, dismissing, or letting it
 * close all count as an answer. A visitor who lands on a page without a
 * translation gets the offer on the first translated page they open.
 */
export function LanguageSuggestion() {
  const locale = useLocale();
  const router = useRouter();
  useEffect((): (() => void) | undefined => {
    let answered: string | null;
    try {
      answered = localStorage.getItem(answeredKey);
    } catch {
      // Without storage the offer would come back on every page.
      return undefined;
    }
    if (answered) return undefined;
    const target = suggestedLocale(navigator.languages, locale);
    if (!target) return undefined;
    const available = () =>
      pageHasLocale(router.state.location.href, target, router.state.matches);
    // Only the visitor's first answer counts; cleanup's own dismiss does not.
    let settled = false;
    let shown: { id: string | number; withdraw: () => void } | undefined;
    const answer = (outcome: string) => {
      if (settled) return;
      settled = true;
      try {
        localStorage.setItem(answeredKey, outcome);
      } catch {
        // The offer may show again on a later page.
      }
      posthog.capture("language_suggestion", {
        from: locale,
        to: target,
        outcome,
      });
    };
    const show = () => {
      // Withdrawing the offer on an untranslated page is not an answer.
      let withdrawn = false;
      const respond = (outcome: string) => {
        if (!withdrawn) answer(outcome);
      };
      const id = toast(translate(target, "common.languageSuggestion"), {
        position: "top-center",
        duration: 12_000,
        closeButton: true,
        action: {
          label: translate(target, "common.languageSuggestionAction"),
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
      });
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
      } else shown ??= show();
    };
    update();
    const unsubscribe = router.subscribe("onResolved", update);
    return () => {
      unsubscribe();
      settled = true;
      if (shown) toast.dismiss(shown.id);
    };
  }, [locale, router]);
  return null;
}
