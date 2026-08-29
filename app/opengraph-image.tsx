import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gate Watch · Black Rock City 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "68px 72px",
          background: "linear-gradient(135deg,#241b11 0%,#0d0a07 58%,#1d1408 100%)",
          color: "#e8dcc6", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#ff9e3d", display: "flex" }} />
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#8a7c64", textTransform: "uppercase" }}>
            Gate Watch
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02 }}>
            How long is the
          </div>
          <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -3, lineHeight: 1.02, color: "#ff9e3d" }}>
            line to the gate?
          </div>
          <div style={{ fontSize: 30, color: "#b8a888", marginTop: 26, maxWidth: 940, lineHeight: 1.35 }}>
            Live Gravel-to-Gate travel times, weather and road chatter for Black Rock City 2026 —
            charted against what the wait actually was in past years.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#8a7c64", letterSpacing: 3 }}>
          BLACK ROCK CITY · AUG 30 – SEP 7, 2026
        </div>
      </div>
    ),
    size,
  );
}
