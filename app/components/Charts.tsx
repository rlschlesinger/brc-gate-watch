"use client";

import { Fragment, useMemo, useState } from "react";
import type { WaitSample } from "@/lib/types";
import { RAMP, RAMP_LABELS, fmtMins, waitColor } from "@/lib/format";
import type { HistCell, HistDay, Stat } from "@/lib/historical";

const PT = "America/Los_Angeles";
const pt = (d: Date | number | string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PT, ...o }).format(new Date(d));

/* -------------------------------------------------------------- live bars */

/**
 * Bars rather than a line: at a glance from a driver's seat, height and colour
 * read faster than a trend line, and they survive being 340px wide.
 */
export function LiveChart({ samples, hours }: { samples: WaitSample[]; hours: number }) {
  const cols = useMemo(() => {
    const cut = Date.now() - hours * 3600_000;
    const rows = samples.filter((s) => new Date(s.at).getTime() >= cut);
    if (rows.length === 0) return [];

    // Aim for at most 24 bars so a 72h view stays legible on a phone.
    const target = hours <= 6 ? 30 : hours <= 12 ? 45 : hours <= 24 ? 60 : 180;
    const bucketMs = target * 60_000;
    const groups = new Map<number, number[]>();
    for (const s of rows) {
      const k = Math.floor(new Date(s.at).getTime() / bucketMs) * bucketMs;
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(s.minutes);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, vals]) => ({
        t,
        minutes: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }));
  }, [samples, hours]);

  if (cols.length < 2) {
    return <p className="lede">Not enough recorded readings yet for a {hours}-hour view. It fills in as the dashboard polls.</p>;
  }

  const max = Math.max(...cols.map((c) => c.minutes), 30);
  const lastIdx = cols.length - 1;
  const step = Math.max(1, Math.ceil(cols.length / 7));

  return (
    <>
      <div className="bars">
        {cols.map((c, i) => (
          <div className={`col${i === lastIdx ? " now" : ""}`} key={c.t}>
            <div
              className="b"
              style={{
                height: `${Math.max(3, (c.minutes / max) * 100)}%`,
                background: waitColor(c.minutes),
                outline: i === lastIdx ? "2px solid var(--ink)" : undefined,
                outlineOffset: i === lastIdx ? 2 : undefined,
              }}
              title={`${pt(c.t, { weekday: "short", hour: "numeric", minute: "2-digit" })} — ${fmtMins(c.minutes)}`}
            />
            <span className="t">
              {i === lastIdx ? "NOW" : i % step === 0 ? pt(c.t, { hour: "numeric" }).replace(/\s?(AM|PM)/i, "") : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="note">
        Peak in this window {fmtMins(max)} · latest {fmtMins(cols[lastIdx].minutes)} at{" "}
        {pt(cols[lastIdx].t, { hour: "numeric", minute: "2-digit" })}. Each bar averages the official readings in
        its slot.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ legend */

export function Legend() {
  return (
    <div className="legend">
      {RAMP.map((c, i) => (
        <span key={c}>
          <i style={{ background: c }} />
          {RAMP_LABELS[i].toUpperCase()}
        </span>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- heatmap */

/** Grid view: one horizontal band per day, 24 hours across. */
export function HeatGrid({
  days, cells, stat, bucket = 2, nowDay, nowHour,
}: {
  days: string[]; cells: HistCell[]; stat: Stat; bucket?: number; nowDay?: string; nowHour?: number;
}) {
  const cols = Math.ceil(24 / bucket);
  const cellW = 22;
  const labW = 52;
  const map = new Map(cells.map((c) => [`${c.day}|${Math.floor(c.hour / bucket) * bucket}`, c]));

  return (
    <div className="hmscroll">
      <div style={{ minWidth: labW + cols * cellW }}>
        <div className="hmhdr" style={{ gridTemplateColumns: `${labW}px repeat(${cols},${cellW}px)` }}>
          <span />
          {Array.from({ length: cols }, (_, i) => {
            const h = i * bucket;
            return <span key={h}>{h % 6 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}</span>;
          })}
        </div>
        {days.map((d) => (
          <div className="hmrow" key={d} style={{ gridTemplateColumns: `${labW}px repeat(${cols},${cellW}px)` }}>
            <span className="lab">{d}</span>
            {Array.from({ length: cols }, (_, i) => {
              const h = i * bucket;
              const c = map.get(`${d}|${h}`);
              const isNow = nowDay === d && nowHour !== undefined && Math.floor(nowHour / bucket) * bucket === h;
              return (
                <span
                  key={h}
                  title={`${d} ${h}:00 — ${c ? `${fmtMins(c[stat])} (${c.n} readings)` : "no data"}`}
                  style={{
                    height: 30,
                    background: c ? waitColor(c[stat]) : "var(--paper2)",
                    borderRight: "2px solid var(--paper)",
                    outline: isNow ? "2px solid var(--ink)" : undefined,
                    outlineOffset: isNow ? -2 : undefined,
                    display: "block",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Clock view: Black Rock City is a clock face, so hours run around the dial and
 * days stack as concentric rings — outermost first.
 */
export function HeatClock({
  days, cells, stat, nowHour,
}: {
  days: string[]; cells: HistCell[]; stat: Stat; nowHour?: number;
}) {
  const rings = days.slice(0, 6);
  if (rings.length === 0) return null;
  const bandWidth = 40 / Math.max(rings.length, 1);
  const byDay = new Map<string, Map<number, HistCell>>();
  for (const c of cells) {
    if (!byDay.has(c.day)) byDay.set(c.day, new Map());
    byDay.get(c.day)!.set(c.hour, c);
  }

  return (
    <div className="clockwrap">
      <div className="clock">
        {rings.map((d, i) => {
          const hours = byDay.get(d);
          const stops: string[] = [];
          for (let h = 0; h < 24; h++) {
            const c = hours?.get(Math.floor(h / 2) * 2);
            stops.push(`${c ? waitColor(c[stat]) : "var(--paper2)"} ${h * 15}deg ${(h + 1) * 15}deg`);
          }
          return (
            <div
              key={d}
              style={{
                position: "absolute",
                inset: `${i * bandWidth}%`,
                borderRadius: "50%",
                border: i === 0 ? "2px solid var(--ink)" : "3px solid var(--paper)",
                backgroundImage: `conic-gradient(from -7.5deg, ${stops.join(", ")})`,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
            backgroundImage:
              "repeating-conic-gradient(from -7.5deg, var(--paper) 0deg 1.2deg, rgba(0,0,0,0) 1.2deg 15deg)",
          }}
        />
        {nowHour !== undefined && (
          <div
            style={{
              position: "absolute", left: "50%", bottom: "50%", width: 2, height: "50%",
              background: "var(--ink)", transformOrigin: "bottom center",
              transform: `translateX(-50%) rotate(${nowHour * 15}deg)`, pointerEvents: "none",
            }}
          />
        )}
        <div className="hub">
          <em>HOURS</em>
          <b>24</b>
        </div>
        <span className="tick" style={{ top: -4, left: "50%", transform: "translate(-50%,-100%)" }}>12a</span>
        <span className="tick" style={{ bottom: -4, left: "50%", transform: "translate(-50%,100%)" }}>12p</span>
        <span className="tick" style={{ right: -6, top: "50%", transform: "translate(100%,-50%)" }}>6a</span>
        <span className="tick" style={{ left: -6, top: "50%", transform: "translate(-100%,-50%)" }}>6p</span>
      </div>
      <div className="ringkey">
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".12em", color: "var(--ink2)" }}>
          RINGS, OUTSIDE IN
        </span>
        {rings.map((d, i) => (
          <b key={d} style={{ color: i === 0 ? "var(--ink)" : "var(--ink2)" }}>{d}</b>
        ))}
        {days.length > rings.length && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink2)" }}>
            +{days.length - rings.length} MORE — SEE GRID
          </span>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- day bars */

export function DayBars({ rows, cells, stat }: { rows: HistDay[]; cells: HistCell[]; stat: Stat }) {
  // The "quietest block" has to be found with the SAME statistic that is on
  // screen. Deriving it from medians while the bar showed a minimum made the
  // two numbers contradict each other.
  const byDay = new Map<string, HistCell[]>();
  for (const c of cells) {
    const list = byDay.get(c.day);
    if (list) list.push(c); else byDay.set(c.day, [c]);
  }
  const quietest = (day: string): HistCell | null => {
    const cs = byDay.get(day);
    if (!cs || cs.length === 0) return null;
    return cs.reduce((a, b) => (a[stat] <= b[stat] ? a : b));
  };
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

  // The faint bar behind is always the day's worst reading, so switching the
  // statistic never hides how bad that day could get.
  const scale = Math.max(60, ...rows.map((r) => Math.max(r.max, r[stat])));
  return (
    <div className="rows">
      {rows.map((r) => {
        const v = r[stat];
        const q = quietest(r.label);
        return (
          <div className="row" key={r.label}>
            <div className="row-top">
              <span className="lab">{r.label}</span>
              <span className="val">{fmtMins(v)}</span>
              {stat !== "max" && <span className="sub">worst {fmtMins(r.max)}</span>}
              {stat !== "min" && <span className="sub">best {fmtMins(r.min)}</span>}
            </div>
            <div className="track">
              <i style={{ width: `${(r.max / scale) * 100}%`, background: waitColor(r.max), opacity: 0.3 }} />
              <i style={{ width: `${(v / scale) * 100}%`, background: waitColor(v) }} />
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink2)", marginTop: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>
              {r.n} readings
              {q && ` · quietest 2h block ${hourLabel(q.hour)} (${fmtMins(q[stat])})`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { Fragment };
