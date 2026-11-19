import { Image as UnpicImage } from "@unpic/react/base";
import { cn } from "cn";
import type { ComponentProps } from "react";
import {
  createStaticImageTransformer,
  getStaticImage,
  getStaticImageWidths,
  type StaticImageManifest,
} from "@/lib/static-images";
import imageMetadata from "@/lib/image-metadata.json" with { type: "json" };

const images: StaticImageManifest = imageMetadata;
const transform = createStaticImageTransformer(images);

export type ImageProps = Omit<
  ComponentProps<"img">,
  "src" | "srcSet" | "width" | "height" | "style" | "alt"
> & {
  src: string;
  /** Describe the image, or pass "" for a decorative one. */
  alt: string;
  width?: number | undefined;
  height?: number | undefined;
  fill?: boolean;
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  breakpoints?: number[];
  layout?: "fixed" | "constrained" | "fullWidth";
  unoptimized?: boolean;
  priority?: boolean;
  background?: string;
};

export function Image({
  src,
  alt,
  width,
  height,
  fill = false,
  objectFit = "contain",
  breakpoints,
  layout,
  unoptimized = false,
  priority,
  background,
  className,
  ...props
}: ImageProps) {
  const metadata = getStaticImage(images, src);
  const aspectRatio = metadata ? metadata.width / metadata.height : undefined;
  const resolvedWidth =
    width ??
    (height && aspectRatio
      ? Math.round(height * aspectRatio)
      : metadata?.width);
  const resolvedHeight =
    height ??
    (width && aspectRatio ? Math.round(width / aspectRatio) : metadata?.height);
  const classes = cn(
    "bg-clip-content bg-origin-content",
    {
      contain: "object-contain",
      cover: "object-cover",
      fill: "object-fill",
      none: "object-none",
      "scale-down": "object-scale-down",
    }[objectFit],
    objectFit === "contain" && "bg-contain! bg-center",
    fill && "size-full!",
    className,
  );
  const pixelated = className?.includes("image-rendering:pixelated");
  const variants = !unoptimized && !pixelated ? metadata?.variants : undefined;
  const placeholder =
    background ?? (variants?.length ? metadata?.background : undefined);

  if (!metadata || !variants?.length) {
    return (
      <img
        {...props}
        src={src}
        alt={alt}
        width={resolvedWidth}
        height={resolvedHeight}
        loading={priority ? "eager" : (props.loading ?? "lazy")}
        fetchPriority={priority ? "high" : props.fetchPriority}
        className={classes}
      />
    );
  }

  return (
    <UnpicImage
      {...props}
      src={src}
      alt={alt}
      {...(layout === "fullWidth" || fill || !resolvedWidth || !resolvedHeight
        ? {
            layout: "fullWidth" as const,
            ...(aspectRatio === undefined ? {} : { aspectRatio }),
          }
        : {
            layout: layout ?? "constrained",
            width: resolvedWidth,
            height: resolvedHeight,
          })}
      {...(priority === undefined ? {} : { priority })}
      objectFit={objectFit}
      {...(placeholder === undefined ? {} : { background: placeholder })}
      breakpoints={getStaticImageWidths(metadata, breakpoints)}
      transformer={transform}
      className={classes}
    />
  );
}
