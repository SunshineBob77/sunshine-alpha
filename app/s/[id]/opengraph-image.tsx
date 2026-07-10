import { ImageResponse } from "next/og";
import { fetchShare } from "@/app/lib/shares";
import { stripMarkdown, truncatePreview } from "@/app/lib/textPreview";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND =
  "linear-gradient(135deg, #FFFBEF 0%, #FEF3D7 55%, #FBC02D 100%)";

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 48 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: "#FFFFFF",
          marginRight: 24,
          fontSize: 56,
        }}
      >
        ☀️
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, color: "#92400E", display: "flex" }}>
        Sunshine
      </div>
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: BACKGROUND,
        padding: "80px",
      }}
    >
      <BrandMark />
      {children}
    </div>
  );
}

function InviteImage() {
  return (
    <CardShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderRadius: 32,
          padding: "48px 72px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: 940,
        }}
      >
        <div
          style={{
            fontSize: 48,
            color: "#111827",
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            lineHeight: 1.3,
          }}
        >
          You&apos;re invited to Sunshine
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#7A7568",
            marginTop: 16,
            display: "flex",
          }}
        >
          Capture ideas, reminders, and notes — and share them with the people who matter.
        </div>
      </div>
    </CardShell>
  );
}

function DropImage({ title, sharerName }: { title: string; sharerName: string }) {
  const clippedTitle = truncatePreview(title, 90);

  return (
    <CardShell>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderRadius: 32,
          padding: "48px 64px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          maxWidth: 940,
        }}
      >
        <div
          style={{
            fontSize: 44,
            color: "#111827",
            fontWeight: 700,
            textAlign: "center",
            display: "flex",
            lineHeight: 1.3,
            marginBottom: 20,
          }}
        >
          {clippedTitle}
        </div>
        <div style={{ fontSize: 26, color: "#92400e", fontWeight: 600, display: "flex" }}>
          Shared by {sharerName} ☀️
        </div>
      </div>
    </CardShell>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === "invite") {
    return new ImageResponse(<InviteImage />, { ...size });
  }

  const share = await fetchShare(id);
  if (!share) {
    return new ImageResponse(<InviteImage />, { ...size });
  }

  const previewTitle = share.title?.trim() || stripMarkdown(share.previewText);

  return new ImageResponse(
    <DropImage title={previewTitle} sharerName={share.sharerName} />,
    { ...size }
  );
}
