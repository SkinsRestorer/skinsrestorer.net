import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import * as FilesComponents from "fumadocs-ui/components/files";
import { Heading } from "fumadocs-ui/components/heading";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Step, Steps } from "fumadocs-ui/components/steps";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

type HeadingLevel = "h2" | "h3" | "h4" | "h5" | "h6";

// Fumadocs shows the copy anchor button only on hover or keyboard focus.
// Touch screens cannot hover, so keep the button visible there.
function headingWithTouchAnchor(as: HeadingLevel) {
  return function TouchAnchorHeading(props: ComponentProps<HeadingLevel>) {
    return (
      <Heading
        as={as}
        {...props}
        className={`pointer-coarse:[&>button]:opacity-100 ${props.className ?? ""}`}
      />
    );
  };
}

const touchAnchorHeadings = {
  h2: headingWithTouchAnchor("h2"),
  h3: headingWithTouchAnchor("h3"),
  h4: headingWithTouchAnchor("h4"),
  h5: headingWithTouchAnchor("h5"),
  h6: headingWithTouchAnchor("h6"),
};

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout,
    Step,
    Steps,
    ...TabsComponents,
    ...FilesComponents,
    ...touchAnchorHeadings,
    // Markdown quotes carry only children, so the callout takes those.
    blockquote: ({ children }: ComponentProps<"blockquote">) => (
      <Callout>{children}</Callout>
    ),
    img: ImageZoom,
    // HTML `ref` attribute conflicts with `forwardRef`
    pre: ({ ref: _ref, ...props }) => (
      // Keep horizontal swipes inside wide code from triggering browser
      // back and forward gestures.
      <CodeBlock
        {...props}
        viewportProps={{ className: "overscroll-x-contain" }}
      >
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...components,
  };
}
