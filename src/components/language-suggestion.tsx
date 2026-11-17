import { useRouter } from "@tanstack/react-router";
import { posthog } from "posthog-js";
import { useEffect } from "react";
import { toast } from "sonner";
import { hasLocalizedPages, localizePath } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-react";
import { suggestedLocale } from "@/lib/language-suggestion";
import { translate } from "@/lib/messages";

const answeredKey = "skinsrestorer:language-suggestion";

/**
 * Offer the page in the browser's language when the site has it. Many
 * visitors land on English pages and rely on browser translation, which also
 * breaks hydration. The offer shows once: switching, dismissing, or letting it
 * close all count as an answer.
 */
export function LanguageSuggestion() {
  const locale = useLocale();
  const router = useRouter();
  useEffect(() => {
    let answered: string | null = null;
    try {
      answered = localStorage.getItem(answeredKey);
    } catch {
      // Without storage the offer would come back on every page.
      return;
    }
    if (answered) return;
    const target = suggestedLocale(navigator.languages ?? [], locale);
    const { href } = router.state.location;
    if (!target || !hasLocalizedPages(href)) return;
    // Only the visitor's first answer counts; cleanup's own dismiss does not.
    let settled = false;
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
    const id = toast(translate(target, "common.languageSuggestion"), {
      position: "top-center",
      duration: 12_000,
      closeButton: true,
      action: {
        label: translate(target, "common.languageSuggestionAction"),
        onClick: () => {
          answer("switched");
          void router.navigate({ href: localizePath(href, target) });
        },
      },
      onDismiss: () => answer("dismissed"),
      onAutoClose: () => answer("ignored"),
    });
    return () => {
      settled = true;
      toast.dismiss(id);
    };
  }, [locale, router]);
  return null;
}
