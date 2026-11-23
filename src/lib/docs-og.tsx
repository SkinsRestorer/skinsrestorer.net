import { ImageResponse } from "takumi-js/response";
import cyrillicFont from "@fontsource-variable/geist/files/geist-cyrillic-wght-normal.woff2?inline";

// The inline import is a data URL, so the font bytes follow the comma.
const [, cyrillicBase64 = ""] = cyrillicFont.split(",");
const cyrillic = Uint8Array.from(
  atob(cyrillicBase64),
  (char) => char.codePointAt(0) ?? 0,
);

export function generateDocsImage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
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
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
