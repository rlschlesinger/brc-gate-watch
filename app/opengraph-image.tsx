import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gate Watch · Black Rock City 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#EDE4D3";
const INK = "#17140F";
const INK2 = "#5B5142";
const RAMP = ["#4F7A46", "#8A7418", "#B0621A", "#A83A1B", "#6E1C12"];

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: PAPER, color: INK, padding: 0, fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "26px 56px", borderBottom: `5px solid ${INK}`,
          }}
        >
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 6, textTransform: "uppercase" }}>
            Gate Watch
          </div>
          <div style={{ fontSize: 20, color: INK2, letterSpacing: 4 }}>BLACK ROCK CITY · 40.7864° N</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", padding: "40px 56px 0", flex: 1 }}>
          <div style={{ fontSize: 22, color: INK2, letterSpacing: 6 }}>
            TRAVEL TIME · GRAVEL PIT → GATE
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 34 }}>
            <div style={{ fontSize: 250, fontWeight: 800, lineHeight: 0.82, letterSpacing: -10 }}>3:40</div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 30 }}>
              <div style={{ fontSize: 22, color: INK2, letterSpacing: 5 }}>HOURS : MINUTES</div>
              <div style={{ fontSize: 26, color: INK2, letterSpacing: 3, marginTop: 10, maxWidth: 460, lineHeight: 1.3 }}>
                Live gate waits, and the history the official dashboard throws away.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", height: 26 }}>
          {RAMP.map((c) => (
            <div key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <div
          style={{
            display: "flex", justifyContent: "space-between", padding: "18px 56px 26px",
            fontSize: 19, color: INK2, letterSpacing: 4,
          }}
        >
          <div>AUG 30 – SEP 7, 2026</div>
          <div>UNOFFICIAL · SAMPLE FIGURE SHOWN</div>
        </div>
      </div>
    ),
    size,
  );
}
