import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F97316",
        }}
      >
        <div
          style={{
            width: "60%",
            height: "60%",
            borderRadius: "50%",
            backgroundColor: "#FDE047",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
