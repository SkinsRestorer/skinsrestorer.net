"use client";

import type { MessageKey } from "@/lib/messages";

import { Dithering } from "@paper-design/shaders-react";
import { Pause, Play } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import styles from "./minecraft.module.css";
import { useT } from "@/lib/i18n-react";
import { required } from "@/lib/utils";

interface DemoCommand {
  command: string;
  reply: MessageKey;
  replyClassName?: string;
  showHead: boolean;
  skin: "applied" | "cleared" | "unchanged";
  description: MessageKey;
}

// Replies match the default English locale of the plugin.
const demoCommands: readonly [DemoCommand, ...DemoCommand[]] = [
  {
    command: "/skin set xknat",
    reply: "home.skinChanged",
    showHead: true,
    skin: "applied",
    description: "home.appliesSkinMinecraftAccountXknat",
  },
  {
    command: "/skins",
    reply: "home.openingSkinsMenu",
    replyClassName: styles["darkGreen"],
    showHead: false,
    skin: "unchanged",
    description: "home.opensMenuSkinsServerHasSaved",
  },
  {
    command: "/skin clear",
    reply: "home.skinWasCleared",
    showHead: false,
    skin: "cleared",
    description: "home.removesSelectionServerThenUsesAccountSkin",
  },
];

interface ChatEntry {
  id: number;
  command: DemoCommand;
}

const autoplayDelay = 4200;
const typingSecondsPerCharacter = 0.045;

function steppedEase(steps: number) {
  return (progress: number) => Math.min(1, Math.ceil(progress * steps) / steps);
}

let webGl2Supported: boolean | undefined;

// Paper Shaders throws when the browser cannot create a WebGL2 context.
function supportsWebGl2() {
  if (webGl2Supported === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    webGl2Supported = gl !== null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return webGl2Supported;
}

const subscribeNever = () => () => {};

function useWebGl2Supported() {
  return useSyncExternalStore(subscribeNever, supportsWebGl2, () => false);
}

function SkinHead() {
  return <span aria-hidden="true" className={styles["head"]} />;
}

export function SkinStage() {
  const t = useT();
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "80px" });
  const reduceMotion = useReducedMotion() ?? false;
  const webGl2 = useWebGl2Supported();
  const [entries, setEntries] = useState<ChatEntry[]>([
    { id: 0, command: demoCommands[0] },
  ]);
  const [autoplay, setAutoplay] = useState(true);

  const latest = required(entries.at(-1), "latest chat entry");
  const lastSkinChange = entries.findLast(
    (entry) => entry.command.skin !== "unchanged",
  );
  const cleared = lastSkinChange?.command.skin === "cleared";
  // The first entry is rendered on the server in its final state, so only later commands animate.
  const animateLatest = latest.id > 0 && !reduceMotion;
  const typingDuration = animateLatest
    ? latest.command.command.length * typingSecondsPerCharacter
    : 0;

  function run(command: DemoCommand) {
    setEntries((previous) => [
      ...previous.slice(-2),
      { id: (previous.at(-1)?.id ?? -1) + 1, command },
    ]);
  }

  const advance = useEffectEvent((from: ChatEntry) => {
    const index = demoCommands.indexOf(from.command);
    run(demoCommands[(index + 1) % demoCommands.length] ?? demoCommands[0]);
  });

  // Every new entry, typed or automatic, restarts the wait for the next one.
  useEffect((): (() => void) | undefined => {
    if (!autoplay || reduceMotion || !inView) return undefined;
    const timer = setTimeout(() => {
      advance(latest);
    }, autoplayDelay);
    return () => {
      clearTimeout(timer);
    };
  }, [autoplay, reduceMotion, inView, latest]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={stageRef}
        className={`${styles["stage"]} relative isolate aspect-square overflow-hidden rounded-lg border border-black/40 shadow-sm sm:aspect-5/4 lg:aspect-4/5`}
      >
        {webGl2 ? (
          <Dithering
            aria-hidden="true"
            className="absolute inset-0 -z-10 size-full"
            colorBack="#171913"
            colorFront="#4d4a1a"
            shape="simplex"
            type="4x4"
            size={3}
            scale={0.7}
            speed={autoplay && inView && !reduceMotion ? 0.35 : 0}
            maxPixelCount={1200 * 1500}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`${styles["backdrop"]} absolute inset-0 -z-10`}
          />
        )}
        <div
          aria-hidden="true"
          className={`${styles["ground"]} absolute inset-x-0 bottom-0 -z-10 h-1/4`}
        />

        <motion.div
          className="absolute inset-x-0 top-[6%] bottom-[30%] flex justify-center"
          animate={{
            opacity: cleared ? 0.55 : 1,
            filter: cleared
              ? "grayscale(1) brightness(0.35)"
              : "grayscale(0) brightness(1)",
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.5,
            delay: typingDuration,
          }}
        >
          <motion.div
            key={cleared ? "cleared" : lastSkinChange?.id}
            className="relative aspect-640/760 h-full"
            initial={
              animateLatest && !cleared
                ? { clipPath: "inset(0% 0% 100% 0%)" }
                : false
            }
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            transition={{
              duration: 0.7,
              delay: typingDuration,
              ease: steppedEase(10),
            }}
          >
            <img
              src="/skinsrestorer-character.png"
              alt={
                cleared
                  ? t("home.minecraftCharacterWithoutSelectedSkin")
                  : t("home.minecraftCharacterWearingSelectedSkin")
              }
              width={640}
              height={760}
              className="absolute inset-0 size-full object-contain [image-rendering:pixelated]"
              fetchPriority="high"
            />
          </motion.div>
        </motion.div>

        {/* WCAG 2.2.2: the demo and shader move for more than 5 seconds, so they need a pause control. */}
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          onClick={() => {
            setAutoplay((value) => !value);
          }}
          aria-label={
            autoplay ? t("home.pauseAnimation") : t("home.playAnimation")
          }
          className="absolute top-2 right-2 motion-reduce:hidden"
        >
          {autoplay ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </Button>

        <div
          className={`${styles["chat"]} absolute inset-x-3 bottom-3 flex flex-col gap-1.5 font-mono leading-snug`}
        >
          <ol
            aria-label={t("home.chat")}
            className="flex flex-col items-start gap-0.5"
          >
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => (
                <motion.li
                  key={entry.id}
                  layout={!reduceMotion}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{
                    opacity: index === entries.length - 1 ? 1 : 0.6,
                    y: 0,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.2,
                    delay: entry === latest ? typingDuration : 0,
                  }}
                  className="max-w-full bg-black/50 px-1.5 py-0.5 text-white"
                >
                  <span className={styles["yellow"]}>
                    [
                    <span className={styles["darkGreen"]}>
                      {"SkinsRestorer"}
                    </span>
                    ]
                  </span>{" "}
                  <span className={entry.command.replyClassName}>
                    {t(entry.command.reply)}
                  </span>
                  {entry.command.showHead ? (
                    <>
                      {" "}
                      <SkinHead />
                    </>
                  ) : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <p className="flex items-center bg-black/60 px-1.5 py-1 text-white">
            <span className="sr-only">{`${t("home.chatInput")}: `}</span>
            <motion.span
              key={latest.id}
              initial={
                animateLatest ? { clipPath: "inset(0 100% 0 0)" } : false
              }
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{
                duration: typingDuration,
                ease: steppedEase(latest.command.command.length),
              }}
              className="whitespace-pre"
            >
              {latest.command.command}
            </motion.span>
            <span
              aria-hidden="true"
              className={
                autoplay
                  ? "ml-px animate-pulse motion-reduce:animate-none"
                  : "ml-px"
              }
            >
              _
            </span>
          </p>
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-wrap gap-2">
        <legend className="sr-only">{t("home.commandsPreview")}</legend>
        {demoCommands.map((item) => (
          <Button
            key={item.command}
            type="button"
            variant={latest.command === item ? "secondary" : "outline"}
            size="sm"
            aria-pressed={latest.command === item}
            onClick={() => {
              setAutoplay(false);
              run(item);
            }}
            className="flex-auto"
          >
            <code className="text-xs">{item.command}</code>
          </Button>
        ))}
      </fieldset>
      {/* Announce only commands the visitor picks, not every autoplay step. */}
      <p
        aria-live={autoplay ? "off" : "polite"}
        className="min-h-10 text-sm text-muted-foreground"
      >
        {t(latest.command.description)}
      </p>
    </div>
  );
}
