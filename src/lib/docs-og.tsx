import { ImageResponse } from "takumi-js/response";
import { workerCache } from "./worker-cache";
import cyrillicFont from "@fontsource-variable/geist/files/geist-cyrillic-wght-normal.woff2?inline";

// The inline import is a data URL, so the font bytes follow the comma.
const [, cyrillicBase64 = ""] = cyrillicFont.split(",");
const cyrillic = Uint8Array.from(
  atob(cyrillicBase64),
  (char) => char.codePointAt(0) ?? 0,
);

interface DocsImageText {
  title: string;
  description?: string | undefined;
}

const BROWSER_CACHE_CONTROL = "public, max-age=3600";
// Keys include a hash of the text, so an edited page gets a new entry. The TTL
// bounds how long a layout change takes to reach cached images.
const SHARED_CACHE_CONTROL = "public, max-age=86400";

function renderDocsImage({ title, description }: DocsImageText) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist Cyrillic",
        width: "100%",
        height: "100%",
        padding: 64,
        backgroundColor: "#0c0c0c",
        color: "white",
        borderBottom: "18px solid #b2a711",
      }}
    >
      {/* Long front matter ends with an ellipsis instead of overflowing. */}
      <p style={{ fontSize: 72, fontWeight: 800, margin: 0, lineClamp: 2 }}>
        {title}
      </p>
      <p style={{ fontSize: 40, color: "#ddd", marginTop: 24, lineClamp: 3 }}>
        {description}
      </p>
      <p style={{ fontSize: 48, color: "#d4c72e", marginTop: "auto" }}>
        SkinsRestorer
      </p>
    </div>,
    {
      width: 1200,
      fonts: [{ name: "Geist Cyrillic", data: cyrillic }],
      height: 630,
      format: "png",
    },
  );
}

async function textVersion({ title, description }: DocsImageText) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([title, description ?? ""])),
  );
  return Array.from(new Uint8Array(digest).subarray(0, 8), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Render a page image once per data center. Workers responses skip the edge
 * cache, so the shared Cache API holds the PNG under its canonical URL.
 */
export async function generateDocsImage(
  canonicalUrl: string,
  text: DocsImageText,
) {
  const cache = workerCache();
  const key = `${canonicalUrl}?v=${await textVersion(text)}`;
  const cached = await cache?.match(key).catch(() => undefined);
  const body = cached
    ? await cached.arrayBuffer()
    : await renderDocsImage(text).arrayBuffer();
  if (!cached)
    await cache
      ?.put(
        key,
        new Response(body, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": SHARED_CACHE_CONTROL,
          },
        }),
      )
      .catch(() => {});
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": BROWSER_CACHE_CONTROL,
    },
  });
}
