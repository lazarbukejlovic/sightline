import { ImageResponse } from "next/og";

// Apple touch icon — same Sightline mark on a warm-paper field so it reads as
// the logo on iOS home screens (which mask to a rounded square of their own).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const INK = "#16150F";
const SIGNAL = "#E5484D";
const PAPER = "#FAF9F6";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PAPER,
        }}
      >
        <div
          style={{
            width: 116,
            height: 116,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: INK,
            borderRadius: 30,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: SIGNAL,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
