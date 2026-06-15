import { ImageResponse } from "next/og";

// App Router favicon convention — the Sightline mark: an ink rounded square
// holding the red signal dot. Brand tokens kept in sync with the in-app logo
// (src/components/landing/site-header.tsx) and globals.css.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const INK = "#16150F";
const SIGNAL = "#E5484D";

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
          background: INK,
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: SIGNAL,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
