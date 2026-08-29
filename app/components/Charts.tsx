"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { WaitSample } from "@/lib/types";
import { fmtMins, waitColor } from "@/lib/format";

const PT = "America/Los_Angeles";
const clock = (d: Date, opts: Intl.DateTimeFormatOptions = { hour: "numeric" }) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PT, ...opts }).format(d);

/* ------------------------------------------------------------- live chart */

export function LiveChart({ samples, hours }: { samples: WaitSample[]; hours: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Draw in real CSS pixels rather than a fixed viewBox: a 720-unit chart squashed
  // into a 360px phone renders its 9px axis labels at four and a half pixels.
  const [w, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = w, H = w < 460 ? 200 : 240, PL = 34, PR = 10, PT_ = 14, PB = 26;

  const view = useMemo(() => {
    const cut = Date.now() - hours * 3600_000;
    return samples.filter((s) => new Date(s.at).getTime() >= cut);
  }, [samples, hours]);

  if (view.length < 2) {
    return (
      <div ref={box}>
        <p className="sub">Not enough recorded points yet for a {hours}-hour chart. It fills in as the dashboard polls.</p>
      </div>
    );
  }

  const t0 = new Date(view[0].at).getTime();
  const t1 = new Date(view[view.length - 1].at).getTime();
  const span = Math.max(t1 - t0, 60_000);
  const maxY = Math.max(60, Math.ceil((Math.max(...view.map((s) => s.minutes)) * 1.15) / 30) * 30);

  const x = (iso: string) => PL + ((new Date(iso).getTime() - t0) / span) * (W - PL - PR);
  const y = (m: number) => PT_ + (1 - m / maxY) * (H - PT_ - PB);

  const line = view.map((s, i) => `${i ? "L" : "M"}${x(s.at).toFixed(1)},${y(s.minutes).toFixed(1)}`).join(" ");
  const area = `${line} L${x(view[view.length - 1].at).toFixed(1)},${H - PB} L${x(view[0].at).toFixed(1)},${H - PB} Z`;

  const yTicks: number[] = [];
  const step = maxY > 480 ? 120 : maxY > 240 ? 60 : 30;
  for (let v = 0; v <= maxY; v += step) yTicks.push(v);

  // one tick per ~3 hours, snapped to the hour
  const xTicks: number[] = [];
  const perTick = W < 460 ? 3 : 5;
  const tickStep = Math.max(1, Math.round(hours / perTick)) * 3600_000;
  let tk = Math.ceil(t0 / tickStep) * tickStep;
  while (tk <= t1) { xTicks.push(tk); tk += tickStep; }

  const hv = hover === null ? null : view[hover];

  return (
    <div className="chartbox" ref={box}>
      <svg
        className="chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`Gravel to Gate travel time over the last ${hours} hours`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff9e3d" stopOpacity=".34" />
            <stop offset="100%" stopColor="#ff9e3d" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line className="gl" x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} />
            <text className="axis" x={PL - 6} y={y(v) + 3} textAnchor="end">{v >= 60 ? `${v / 60}h` : `${v}m`}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} className="axis" x={x(new Date(t).toISOString())} y={H - 9} textAnchor="middle">
            {clock(new Date(t))}
          </text>
        ))}

        <path d={area} fill="url(#ag)" />
        <path d={line} fill="none" stroke="#ff9e3d" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {view.map((s, i) => (
          <circle key={s.at + i} cx={x(s.at)} cy={y(s.minutes)} r={hover === i ? 5 : 2.6}
            fill={waitColor(s.minutes)} stroke="#0d0a07" strokeWidth={hover === i ? 1.6 : 0.8} />
        ))}

        {/* generous invisible hit targets so this works with a thumb */}
        {view.map((s, i) => (
          <rect key={`h${i}`} x={x(s.at) - (W - PL - PR) / view.length / 2} y={0}
            width={(W - PL - PR) / view.length} height={H} fill="transparent"
            onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
        ))}

        {hv && (
          <g>
            <line className="gl" x1={x(hv.at)} x2={x(hv.at)} y1={PT_} y2={H - PB} stroke="#ff9e3d" strokeOpacity=".45" />
            <text className="axis" x={Math.min(Math.max(x(hv.at), PL + 42), W - PR - 42)} y={PT_ + 9}
              textAnchor="middle" fill="#e8dcc6" style={{ fontSize: 11, fontWeight: 700 }}>
              {fmtMins(hv.minutes)} · {clock(new Date(hv.at), { hour: "numeric", minute: "2-digit" })}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------- heatmap */

export type HeatCell = { day: string; hour: number; typical: number | null; n: number };

export function Heatmap({
  days, cells, bucket = 2, nowDay, nowHour,
}: {
  days: string[]; cells: HeatCell[]; bucket?: number; nowDay?: string; nowHour?: number;
}) {
  const cols = Math.ceil(24 / bucket);
  const key = (d: string, h: number) => `${d}|${h}`;
  const map = new Map(cells.map((c) => [key(c.day, Math.floor(c.hour / bucket) * bucket), c]));

  return (
    <>
      <div className="hmwrap">
      <div className="hm" style={{ gridTemplateColumns: `30px repeat(${cols},minmax(0,1fr))` }}>
        <div />
        {Array.from({ length: cols }, (_, i) => {
          const h = i * bucket;
          return (
            <div key={h} className="rowlab" style={{ aspectRatio: "auto", fontSize: 8.5 }}>
              {h % 6 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}
            </div>
          );
        })}
        {days.map((d) => (
          <Fragment key={d}>
            <div className="rowlab">{d}</div>
            {Array.from({ length: cols }, (_, i) => {
              const h = i * bucket;
              const c = map.get(key(d, h));
              const isNow = nowDay === d && nowHour !== undefined && Math.floor(nowHour / bucket) * bucket === h;
              return (
                <div
                  key={`${d}${h}`} className="hcell"
                  title={`${d} ${h}:00 — ${c?.typical != null ? fmtMins(c.typical) : "no data"}${c?.n ? ` (${c.n} reports)` : ""}`}
                  style={{
                    background: waitColor(c?.typical ?? null),
                    outline: isNow ? "2px solid #fff" : undefined,
                    outlineOffset: isNow ? "-2px" : undefined,
                  }}
                >
                  {c?.typical != null && c.typical >= 60 ? Math.round(c.typical / 60) : ""}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      </div>
      <div className="legend">
        <span>faster</span>
        {[0, 45, 90, 180, 300, 480, 720].map((v) => (
          <span key={v} className="swatch" style={{ background: waitColor(v) }} title={fmtMins(v)} />
        ))}
        <span>slower</span>
        <span style={{ marginLeft: "auto" }}>numbers = hours</span>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- day bars */

export function DayBars({
  rows,
}: {
  rows: { label: string; typical: number | null; peak: number | null; note?: string }[];
}) {
  const max = Math.max(60, ...rows.map((r) => r.peak ?? r.typical ?? 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, minWidth: 74, color: "var(--sand-dim)" }}>{r.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtMins(r.typical)}</span>
            {r.peak != null && r.peak !== r.typical && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--sand-faint)" }}>peak {fmtMins(r.peak)}</span>
            )}
          </div>
          <div style={{ height: 9, borderRadius: 5, background: "rgba(255,255,255,.05)", position: "relative", overflow: "hidden" }}>
            {r.peak != null && (
              <div style={{ position: "absolute", inset: 0, width: `${(r.peak / max) * 100}%`, background: waitColor(r.peak), opacity: 0.32 }} />
            )}
            {r.typical != null && (
              <div style={{ position: "absolute", inset: 0, width: `${(r.typical / max) * 100}%`, background: waitColor(r.typical), borderRadius: 5 }} />
            )}
          </div>
          {r.note && <div style={{ fontSize: 11.5, color: "var(--sand-faint)", marginTop: 3 }}>{r.note}</div>}
        </div>
      ))}
    </div>
  );
}
