import { ImageResponse } from "next/og";
import { parseTravelMinutes, tocToSamples } from "@/lib/parse";

export const runtime = "edge";
export const alt = "Gate Watch · Black Rock City 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

const PAPER = "#EDE4D3";
const PAPER2 = "#E3D7C0";
const INK = "#17140F";
const INK2 = "#5B5142";
const RULE = "#BFAD91";
const RAMP = ["#4F7A46", "#8A7418", "#B0621A", "#A83A1B", "#6E1C12"];

const ramp = (m: number) => (m < 45 ? RAMP[0] : m < 90 ? RAMP[1] : m < 150 ? RAMP[2] : m < 240 ? RAMP[3] : RAMP[4]);
const word = (m: number) => (m < 45 ? "MOVING" : m < 90 ? "NORMAL" : m < 150 ? "SLOW" : m < 240 ? "HEAVY" : "BRUTAL");
const clock = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;

/** Barlow Condensed, so the card carries the same voice as the page. */
async function condensed(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@800&display=swap",
      { headers: { "user-agent": "Mozilla/5.0" }, next: { revalidate: 86400 } },
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** A live snapshot beats a mock-up: the share card shows the real current wait. */
async function snapshot() {
  try {
    const r = await fetch("https://brcdashboard.burningman.org/api/feed/public", {
      headers: { "user-agent": "Mozilla/5.0" },
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const posts: { minutes: number | null; at: number }[] = (j?.synced?.traffic ?? []).map((t: any) => ({
      minutes: parseTravelMinutes(t.note_tweet || t.text || ""),
      at: Date.parse(t.created_at),
    }));
    const toc = tocToSamples(j?.synced?.toc, j?.serverTime ?? Date.now());
    const merged = [
      ...posts.filter((p) => p.minutes !== null).map((p) => ({ at: p.at, minutes: p.minutes as number })),
      ...toc.map((s) => ({ at: Date.parse(s.at), minutes: s.minutes })),
    ].sort((a, b) => a.at - b.at);
    if (merged.length === 0) return null;
    const vals = merged.map((m) => m.minutes).sort((a, b) => a - b);
    return {
      current: merged[merged.length - 1].minutes,
      median: vals[Math.floor(vals.length / 2)],
      best: vals[0],
      worst: vals[vals.length - 1],
      spark: merged.slice(-22),
      at: merged[merged.length - 1].at,
    };
  } catch {
    return null;
  }
}

export default async function OG() {
  const [snap, font] = await Promise.all([snapshot(), condensed()]);
  const cur = snap?.current ?? null;
  const sparkMax = Math.max(60, ...(snap?.spark.map((s) => s.minutes) ?? [60]));

  const stamp = snap
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "2-digit",
      }).format(new Date(snap.at)) + " PT"
    : "AWAITING FIRST READING";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 54px", borderBottom: `5px solid ${INK}` }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>Gate Watch</div>
          <div style={{ fontSize: 19, color: INK2, letterSpacing: 4 }}>BLACK ROCK CITY · 40.7864° N</div>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 54px", flex: 1 }}>
            <div style={{ fontSize: 21, color: INK2, letterSpacing: 5 }}>TRAVEL TIME · GRAVEL PIT → GATE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 4 }}>
              <div style={{ fontSize: 200, fontWeight: 800, lineHeight: 0.84, letterSpacing: -8 }}>
                {cur === null ? "—:—" : clock(cur)}
              </div>
              {cur !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 24 }}>
                  <div style={{ width: 26, height: 26, background: ramp(cur) }} />
                  <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 3, color: ramp(cur) }}>{word(cur)}</div>
                </div>
              )}
            </div>
            <div style={{ fontSize: 21, color: INK2, letterSpacing: 5, marginTop: 2 }}>
              {cur === null ? "LIVE GATE WAITS, AND THE HISTORY THE DASHBOARD DISCARDS" : `HOURS : MINUTES · ${stamp}`}
            </div>

            {snap && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 92, marginTop: 26, width: 620 }}>
                {snap.spark.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.max(6, (s.minutes / sparkMax) * 100)}%`,
                      background: ramp(s.minutes),
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {snap && (
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 26, width: 300, padding: "0 54px 0 24px", borderLeft: `2px solid ${RULE}` }}>
              {([["MEDIAN", snap.median], ["BEST", snap.best], ["WORST", snap.worst]] as const).map(([k, v]) => (
                <div key={k} style={{ display: "flex", flexDirection: "column", borderTop: `6px solid ${ramp(v)}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 17, color: INK2, letterSpacing: 4 }}>{`${k} · WINDOW`}</div>
                  <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{clock(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", height: 22 }}>
          {RAMP.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 54px 22px", fontSize: 18, color: INK2, letterSpacing: 4, background: PAPER2 }}>
          <div>AUG 30 – SEP 7, 2026</div>
          <div>UNOFFICIAL · READINGS FROM THE BRC DASHBOARD</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Barlow Condensed", data: font, weight: 800 as const, style: "normal" as const }]
        : undefined,
    },
  );
}
