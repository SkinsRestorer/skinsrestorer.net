import { ImageResponse } from "takumi-js/response";

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
        width: "100%",
        height: "100%",
        padding: 64,
        backgroundColor: "#0c0c0c",
        color: "white",
        borderBottom: "18px solid #b2a711",
      }}
    >
      <p style={{ fontSize: 72, fontWeight: 800, margin: 0 }}>{title}</p>
      <p style={{ fontSize: 40, color: "#ddd", marginTop: 24 }}>
        {description}
      </p>
      <p style={{ fontSize: 48, color: "#d4c72e", marginTop: "auto" }}>
        SkinsRestorer
      </p>
    </div>,
    {
      width: 1200,
      height: 630,
      format: "png",
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
