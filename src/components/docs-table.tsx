import { type ComponentProps, useEffect, useRef, useState } from "react";

const headingSelector = "h1, h2, h3, h4, h5, h6";

/**
 * The text of the last heading before `element`. A linked heading also holds
 * the copy-link button, so read only the link text.
 */
function nearestHeadingText(element: Element) {
  const heading = [...document.querySelectorAll(headingSelector)].findLast(
    (candidate) =>
      candidate.compareDocumentPosition(element) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const text = (
    heading?.querySelector(":scope > a[href^='#']") ?? heading
  )?.textContent.trim();
  return text === "" ? undefined : text;
}

/**
 * Like the Fumadocs table, but horizontal swipes inside a wide table do not
 * trigger browser back and forward gestures. Keyboard users focus the region
 * to scroll it, and screen readers name it after the section it belongs to.
 */
export function DocsTable(props: ComponentProps<"table">) {
  const ref = useRef<HTMLElement>(null);
  const [label, setLabel] = useState<string>();
  useEffect(() => {
    if (ref.current) setLabel(nearestHeadingText(ref.current));
  }, []);
  return (
    <section
      ref={ref}
      aria-label={label}
      className="relative my-6 prose-no-margin overflow-auto overscroll-x-contain"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users scroll wide tables.
      tabIndex={0}
    >
      <table {...props} />
    </section>
  );
}
