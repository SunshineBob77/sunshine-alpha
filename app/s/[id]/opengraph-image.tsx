import { ImageResponse } from "next/og";
import { fetchShare } from "@/app/lib/shares";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await fetchShare(id);

  const sharerName = share?.sharerName ?? "Someone";
  const title = share?.previewText ?? "shared a Drop of Sunshine";
  const clippedTitle = title.length > 100 ? `${title.slice(0, 100)}…` : title;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #fde68a 100%)",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 96, marginRight: 24, display: "flex" }}>🌞</div>
          <div style={{ fontSize: 72, fontWeight: 700, color: "#78350f", display: "flex" }}>
            sunshine
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: 32,
            padding: "48px 64px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: "#92400e",
              fontWeight: 600,
              display: "flex",
              marginBottom: 16,
            }}
          >
            A drop of sunshine from {sharerName} ☀️
          </div>
          <div
            style={{
              fontSize: 40,
              color: "#111827",
              fontWeight: 700,
              textAlign: "center",
              display: "flex",
              lineHeight: 1.3,
            }}
          >
            {clippedTitle}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
