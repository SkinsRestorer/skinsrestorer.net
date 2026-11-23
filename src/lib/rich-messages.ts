import type { ReactNode } from "react";
import type { MessageKey } from "./messages";

/**
 * The tags and `{placeholders}` of each message that `t.rich` renders.
 * `bun run i18n:check` fails when a list differs from the English message.
 */
export const richMessages = {
  "capes.mineskinCoupon": ["code", "link"],
  "common.sponsoredByEnderDash": ["link"],
  "consent.allowAnalyticsDetails": ["allow", "policy"],
  "home.faqFreeAnswer": ["github", "plans"],
  "home.faqHelpAnswer": ["discord", "guides", "issues"],
  "home.faqIntro": ["docs"],
  "home.faqSkinFileAnswer": ["command", "generator", "upload"],
  "pricing.onlyMembershipGrantsPerks": ["strong"],
  "pricing.supporterPerksDiscord": ["discord"],
  "studio.draftChanged": ["name", "time"],
} as const satisfies Partial<Record<MessageKey, readonly string[]>>;

export type RichMessageKey = keyof typeof richMessages;

/** Exactly one value for each tag and placeholder of the message. */
export type RichMessageValues<K extends RichMessageKey> = Readonly<
  Record<(typeof richMessages)[K][number], ReactNode>
>;
