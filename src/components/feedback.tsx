"use client";
import { cva } from "class-variance-authority";
import {
  Collapsible,
  CollapsibleContent,
} from "fumadocs-ui/components/ui/collapsible";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { posthog } from "posthog-js";
import {
  type SubmitEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n-react";

const rateButtonVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed [&_svg]:size-4",
  {
    variants: {
      active: {
        true: "bg-fd-accent text-fd-accent-foreground [&_svg]:fill-current",
        false: "text-fd-muted-foreground",
      },
    },
  },
);

interface FeedbackData {
  opinion: "good" | "bad";
  message: string;
}

const subscribeNever = () => () => {};

function readStoredFeedback(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    // Feedback remains usable when browser storage is unavailable.
    return null;
  }
}

function parseFeedback(item: string | null): FeedbackData | null {
  if (!item) return null;
  try {
    const feedback: unknown = JSON.parse(item);
    if (
      typeof feedback === "object" &&
      feedback !== null &&
      "opinion" in feedback &&
      (feedback.opinion === "good" || feedback.opinion === "bad") &&
      "message" in feedback &&
      typeof feedback.message === "string"
    ) {
      return { opinion: feedback.opinion, message: feedback.message };
    }
  } catch {
    // Invalid stored feedback is ignored.
  }
  return null;
}

export function Feedback({ url, version }: { url: string; version: string }) {
  const t = useT();
  const messageId = useId();
  const questionId = useId();
  const [opinion, setOpinion] = useState<"good" | "bad" | null>(null);
  const [message, setMessage] = useState("");
  // The form unmounts on submit, so focus moves to the thank-you message.
  const [submitted, setSubmitted] = useState(false);
  const thanksRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitted) thanksRef.current?.focus();
  }, [submitted]);
  const storageKey = `docs-feedback-${version}-${url}`;
  // Stored feedback is read after hydration. A choice made on this page
  // replaces it, also when browser storage is unavailable.
  const stored = useSyncExternalStore(
    subscribeNever,
    () => readStoredFeedback(storageKey),
    () => null,
  );
  const [choice, setChoice] = useState<{
    key: string;
    feedback: FeedbackData | null;
  }>();
  const previous =
    choice?.key === storageKey ? choice.feedback : parseFeedback(stored);
  const setPrevious = (feedback: FeedbackData | null) => {
    setChoice({ key: storageKey, feedback });
  };

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opinion === null) return;

    const feedback = { opinion, message: message.trim() };
    posthog.capture("on_rate_docs", { url, version, ...feedback });
    setPrevious(feedback);
    setMessage("");
    setOpinion(null);
    setSubmitted(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(feedback));
    } catch {
      // Persistence is optional; the submitted feedback still stays visible.
    }
  }

  const activeOpinion = previous?.opinion ?? opinion;

  return (
    <Collapsible
      open={opinion !== null || previous !== null}
      className="border-y py-3"
    >
      <fieldset
        aria-labelledby={questionId}
        className="flex min-w-0 flex-row flex-wrap items-center gap-2"
      >
        <p id={questionId} className="pe-2 text-sm font-medium">
          {t("feedback.didPageHelp")}
        </p>
        <button
          type="button"
          disabled={previous !== null}
          aria-pressed={activeOpinion === "good"}
          className={cn(
            rateButtonVariants({
              active: activeOpinion === "good",
            }),
          )}
          onClick={() => {
            setOpinion((current) => (current === "good" ? null : "good"));
          }}
        >
          <ThumbsUp aria-hidden="true" />
          {t("feedback.yes")}
        </button>
        <button
          type="button"
          disabled={previous !== null}
          aria-pressed={activeOpinion === "bad"}
          className={cn(
            rateButtonVariants({
              active: activeOpinion === "bad",
            }),
          )}
          onClick={() => {
            setOpinion((current) => (current === "bad" ? null : "bad"));
          }}
        >
          <ThumbsDown aria-hidden="true" />
          {t("feedback.no")}
        </button>
      </fieldset>
      <CollapsibleContent className="mt-3">
        {previous ? (
          <div
            ref={thanksRef}
            tabIndex={-1}
            className="flex flex-col items-center gap-3 rounded-xl bg-fd-card px-3 py-6 text-center text-sm text-fd-muted-foreground outline-none"
          >
            <p>{t("feedback.thankYouFeedback")}</p>
            <div className="flex flex-row items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpinion(previous.opinion);
                  setPrevious(null);
                  setSubmitted(false);
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    // Allow resubmitting even if browser storage is unavailable.
                  }
                }}
              >
                {t("feedback.submitAgain")}
              </Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Field>
              <FieldLabel htmlFor={messageId}>
                {t("feedback.whatWorkedWhichStepNeedsCorrection")}{" "}
                <span className="text-fd-muted-foreground">
                  ({t("feedback.optional")})
                </span>
              </FieldLabel>
              <textarea
                id={messageId}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- Focus the feedback field when it opens.
                autoFocus
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                }}
                className="resize-none rounded-lg border bg-fd-secondary p-3 text-fd-secondary-foreground placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                placeholder={t(
                  "feedback.includeStepSetupResultKeepCredentialsPrivate",
                )}
                onKeyDown={(e) => {
                  if (!e.shiftKey && e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </Field>
            <Button type="submit" variant="outline" className="w-fit">
              {t("feedback.submit")}
            </Button>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
