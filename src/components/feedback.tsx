"use client";
import { cva } from "class-variance-authority";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "fumadocs-ui/components/ui/collapsible";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import posthog from "posthog-js";
import { type SubmitEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const rateButtonVariants = cva(
  "inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium border text-sm [&_svg]:size-4 disabled:cursor-not-allowed",
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

export function Feedback({ url }: { url: string }) {
  const [previous, setPrevious] = useState<FeedbackData | null>(null);
  const [opinion, setOpinion] = useState<"good" | "bad" | null>(null);
  const [message, setMessage] = useState("");
  const storageKey = `docs-feedback-${url}`;

  useEffect(() => {
    try {
      const item = localStorage.getItem(storageKey);
      if (item) {
        const feedback = JSON.parse(item);
        if (
          (feedback.opinion === "good" || feedback.opinion === "bad") &&
          typeof feedback.message === "string"
        ) {
          setPrevious(feedback);
        }
      }
    } catch {
      // Feedback remains usable when browser storage is unavailable or invalid.
    }
  }, [storageKey]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opinion === null) return;

    const feedback = { opinion, message };
    posthog.capture("on_rate_docs", { url, ...feedback });
    setPrevious(feedback);
    setMessage("");
    setOpinion(null);
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
      onOpenChange={(v) => {
        if (!v) setOpinion(null);
      }}
      className="border-y py-3"
    >
      <div className="flex flex-row items-center gap-2">
        <p className="text-sm font-medium pe-2">How is this guide?</p>
        <button
          type="button"
          disabled={previous !== null}
          className={cn(
            rateButtonVariants({
              active: activeOpinion === "good",
            }),
          )}
          onClick={() => {
            setOpinion("good");
          }}
        >
          <ThumbsUp />
          Good
        </button>
        <button
          type="button"
          disabled={previous !== null}
          className={cn(
            rateButtonVariants({
              active: activeOpinion === "bad",
            }),
          )}
          onClick={() => {
            setOpinion("bad");
          }}
        >
          <ThumbsDown />
          Bad
        </button>
      </div>
      <CollapsibleContent className="mt-3">
        {previous ? (
          <div className="px-3 py-6 flex flex-col items-center gap-3 bg-fd-card text-fd-muted-foreground text-sm text-center rounded-xl">
            <p>Thank you for your feedback!</p>
            <div className="flex flex-row items-center gap-2">
              <button
                type="button"
                className={cn(
                  buttonVariants({
                    color: "secondary",
                  }),
                  "text-xs",
                )}
                onClick={() => {
                  setOpinion(previous.opinion);
                  setPrevious(null);
                  try {
                    localStorage.removeItem(storageKey);
                  } catch {
                    // Allow resubmitting even if browser storage is unavailable.
                  }
                }}
              >
                Submit Again
              </button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <textarea
              // biome-ignore lint/a11y/noAutofocus: We want to autofocus the textarea when it appears
              autoFocus
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border rounded-lg bg-fd-secondary text-fd-secondary-foreground p-3 resize-none focus-visible:outline-none placeholder:text-fd-muted-foreground"
              placeholder="Leave your feedback..."
              onKeyDown={(e) => {
                if (!e.shiftKey && e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              className={cn(buttonVariants({ color: "outline" }), "w-fit px-3")}
            >
              Submit
            </button>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
