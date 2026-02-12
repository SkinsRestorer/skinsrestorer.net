"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import {
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const GrainGradient = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.GrainGradient),
  { ssr: false },
);

const Dithering = dynamic(
  () => import("@paper-design/shaders-react").then((mod) => mod.Dithering),
  { ssr: false },
);

let observer: IntersectionObserver;
const observerTargets = new WeakMap<
  Element,
  (entry: IntersectionObserverEntry) => void
>();

function useIsVisible(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        observerTargets.get(entry.target)?.(entry);
      }
    });

    const element = ref.current;
    if (!element) return;
    observerTargets.set(element, (entry) => {
      setVisible(entry.isIntersecting);
    });
    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observerTargets.delete(element);
    };
  }, [ref]);

  return visible;
}

export function HeroBackground() {
  const { resolvedTheme } = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useIsVisible(ref);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden rounded-2xl">
      <GrainGradient
        className="absolute inset-0 animate-in fade-in duration-800"
        colors={
          resolvedTheme === "dark"
            ? ["#B2A711", "#8a7d0e", "#1a1a0000"]
            : ["#e8dc3c", "#d4c91a", "#b2a71120"]
        }
        colorBack="#00000000"
        softness={1}
        intensity={0.9}
        noise={0.5}
        speed={visible ? 0.8 : 0}
        shape="corners"
        minPixelRatio={1}
        maxPixelCount={1920 * 1080}
      />
      <Dithering
        width={720}
        height={720}
        colorBack="#00000000"
        colorFront={resolvedTheme === "dark" ? "#B2A711" : "#d4c91a"}
        shape="sphere"
        type="4x4"
        scale={0.5}
        size={3}
        speed={0}
        frame={5000 * 120}
        className="absolute animate-in fade-in duration-400 max-lg:bottom-[-50%] max-lg:left-[-200px] lg:top-[-5%] lg:right-0"
        minPixelRatio={1}
      />
    </div>
  );
}

export function HomeFaq({
  items,
}: {
  items: { question: string; answer: React.ReactNode }[];
}) {
  return (
    <Accordion type="single" collapsible className="w-full">
      {items.map((item, i) => (
        <AccordionItem key={item.question} value={`faq-${i}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
