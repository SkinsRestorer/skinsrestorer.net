"use client";

import { Dithering } from "@paper-design/shaders-react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import styles from "./minecraft.module.css";

type DemoCommand = {
  command: string;
  reply: string;
  replyClassName?: string;
  showHead: boolean;
  skin: "applied" | "cleared" | "unchanged";
  description: string;
};

// Replies match the default English locale of the plugin.
const demoCommands: DemoCommand[] = [
  {
    command: "/skin set xknat",
    reply: "Your skin changed.",
    showHead: true,
    skin: "applied",
    description: "Applies the skin of the Minecraft account xknat.",
  },
  {
    command: "/skins",
    reply: "Opening the skins menu...",
    replyClassName: styles.darkGreen,
    showHead: false,
    skin: "unchanged",
    description: "Opens a menu of skins the server has saved.",
  },
  {
    command: "/skin clear",
    reply: "Your skin was cleared.",
    showHead: false,
    skin: "cleared",
    description:
      "Removes your selection. The server then uses your account skin or its default skin.",
  },
];

type ChatEntry = { id: number; command: DemoCommand };

const autoplayDelay = 4200;
const typingSecondsPerCharacter = 0.045;

function steppedEase(steps: number) {
  return (progress: number) => Math.min(1, Math.ceil(progress * steps) / steps);
}

function SkinHead() {
  return <span aria-hidden="true" className={styles.head} />;
}

export function SkinStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "80px" });
  const reduceMotion = useReducedMotion() ?? false;
  const [entries, setEntries] = useState<ChatEntry[]>([
    { id: 0, command: demoCommands[0] },
  ]);
  const [autoplay, setAutoplay] = useState(true);

  const latest = entries[entries.length - 1];
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
      { id: previous[previous.length - 1].id + 1, command },
    ]);
  }

  const advance = useEffectEvent(() => {
    const index = demoCommands.indexOf(latest.command);
    run(demoCommands[(index + 1) % demoCommands.length]);
  });

  useEffect(() => {
    if (!autoplay || reduceMotion || !inView) return;
    const timer = setTimeout(advance, autoplayDelay);
    return () => clearTimeout(timer);
  }, [autoplay, reduceMotion, inView, entries]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={stageRef}
        className={`${styles.stage} relative isolate aspect-square overflow-hidden rounded-lg border border-black/40 shadow-sm sm:aspect-[5/4] lg:aspect-[4/5]`}
      >
        <Dithering
          aria-hidden="true"
          className="absolute inset-0 -z-10 size-full"
          colorBack="#171913"
          colorFront="#4d4a1a"
          shape="simplex"
          type="4x4"
          size={3}
          scale={0.7}
          speed={inView && !reduceMotion ? 0.35 : 0}
          maxPixelCount={1200 * 1500}
        />
        <div
          aria-hidden="true"
          className={`${styles.ground} absolute inset-x-0 bottom-0 -z-10 h-1/4`}
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
            className="relative h-full aspect-[640/760]"
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
            <Image
              src="/skinsrestorer-character.png"
              alt={
                cleared
                  ? "Minecraft character without a selected skin"
                  : "Minecraft character wearing the selected skin"
              }
              fill
              sizes="(min-width: 1024px) 360px, 70vw"
              className="object-contain [image-rendering:pixelated]"
              preload
            />
          </motion.div>
        </motion.div>

        <div
          className={`${styles.chat} absolute inset-x-3 bottom-3 flex flex-col gap-1.5 font-mono leading-snug`}
        >
          <ol aria-label="Chat" className="flex flex-col items-start gap-0.5">
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
                  <span className={styles.yellow}>
                    [<span className={styles.darkGreen}>SkinsRestorer</span>]
                  </span>{" "}
                  <span className={entry.command.replyClassName}>
                    {entry.command.reply}
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
          <p
            aria-label="Chat input"
            className="flex items-center bg-black/60 px-1.5 py-1 text-white"
          >
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
              className="ml-px animate-pulse motion-reduce:animate-none"
            >
              _
            </span>
          </p>
        </div>
      </div>

      <fieldset className="flex min-w-0 flex-wrap gap-2">
        <legend className="sr-only">Commands to preview</legend>
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
      <p aria-live="polite" className="min-h-10 text-sm text-muted-foreground">
        {latest.command.description}
      </p>
    </div>
  );
}
