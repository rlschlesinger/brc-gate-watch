"use client";

import { useMemo } from "react";
import { fmtMins, waitColor } from "@/lib/format";
import { combine, STATS, type Historical, type Stat } from "@/lib/historical";

const PT = "America/Los_Angeles";
const GATE_OPEN = Date.parse("2026-08-30T07:01:00.000Z");
/** Reno → Gerlach on 447, before the gravel. Roughly two and a quarter hours. */
const DRIVE_TO_GRAVEL_MIN = 135;
const BUCKET = 2;

type Window = {
  start: number;         // ms, start of the 2-hour arrival bucket
  dayLabel: string;
  hour: number;
  byYear: { year: string; typical: number }[];
  low: number; high: number;
  /** the years combined with the selected statistic — what the ranking sorts on */
  score: number;
};

function labelFor(ms: number): string {
  const off = Math.floor((ms - GATE_OPEN) / 86_400_000 + 1) - 1;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: PT, weekday: "short" }).format(new Date(ms));
  return off === 0 ? "SUN open" : `${wd} ${off >= 0 ? "+" : ""}${off}`;
}

const pt = (ms: number, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PT, ...o }).format(new Date(ms));

export default function WhenToLeave({ historical, now, num, stat }: { historical: Historical; now: number; num: string; stat: Stat }) {
  const windows = useMemo<Window[]>(() => {
    if (historical.status !== "ok") return [];
    const allow = historical.rankingYears?.length
      ? new Set(historical.rankingYears)
      : new Set(Object.keys(historical.years));
    const years = Object.entries(historical.years).filter(([k]) => allow.has(k));
    const out: Window[] = [];

    // Walk the next three days in two-hour arrival buckets.
    for (let i = 0; i < 36; i++) {
      const start = Math.ceil(now / (BUCKET * 3600_000)) * (BUCKET * 3600_000) + i * BUCKET * 3600_000;
      const dayLabel = labelFor(start);
      const hour = Number(pt(start, { hour: "numeric", hour12: false }).replace(/\D/g, "")) % 24;
      const bucket = Math.floor(hour / BUCKET) * BUCKET;

      const byYear: { year: string; typical: number }[] = [];
      for (const [yk, yv] of years) {
        const c = yv.arrival.cells.find((x) => x.day === dayLabel && x.hour === bucket);
        if (c) byYear.push({ year: yk, typical: c[stat] });
      }
      if (byYear.length === 0) continue;
      const vals = byYear.map((b) => b.typical);
      out.push({
        start, dayLabel, hour: bucket, byYear,
        low: Math.min(...vals),
        high: Math.max(...vals),
        score: combine(vals, stat),
      });
    }
    return out;
  }, [historical, now, stat]);

  if (windows.length === 0) return null;

  const yearCount = (historical.rankingYears?.length ?? Object.keys(historical.years).length);
  const rankedYears = historical.rankingYears ?? Object.keys(historical.years);

  // Only compare like with like: a window that just happens to lack a reading
  // from the bad year would otherwise sort straight to the top.
  const reachable = windows.filter((w) => w.start - DRIVE_TO_GRAVEL_MIN * 60_000 > now - 30 * 60_000);
  const full = reachable.filter((w) => w.byYear.length === yearCount);
  const pool = full.length >= 3 ? full : reachable;

  // Rank by the pessimistic case — you cannot pick which year you get.
  const ranked = [...pool].sort((a, b) => a.score - b.score || a.low - b.low).slice(0, 4);
  const worst = [...pool].sort((a, b) => b.score - a.score)[0];
  const statLabel = STATS.find((s) => s.id === stat)?.prose ?? stat;
  const partial = pool !== full;

  return (
    <section className="sec">
      <div className="sec-hd">
        <div className="l">
          <span className="sec-num">{num}</span>
          <h2>When to arrive</h2>
        </div>
      </div>
      <p className="lede">
        Every upcoming two-hour arrival window, scored by what that same day-and-hour actually cost in{" "}
        {rankedYears.join(", ")}. Each year&rsquo;s <em>{statLabel}</em> for that slot, then combined across years the
        same way. Thinner years in the record below are left out of the scoring.
        {stat === "max" && " Worst case is the one to plan around \u2014 you do not get to pick which year you are in."}
        {stat === "min" && " Best case happened once. Do not build a plan on it."}
        {(stat === "median" || stat === "mean") && " Per-year figures are shown on every row, so a calm average hiding one brutal year stays visible."}
      </p>

      <div className="rows">
        {ranked.map((w, i) => {
          const leave = w.start - DRIVE_TO_GRAVEL_MIN * 60_000;
          const past = leave < now;
          return (
            <div className="rank" key={w.start}>
              <span className="n" style={{ background: waitColor(w.score) }}>{i + 1}</span>
              <div className="m">
                <b>
                  {pt(w.start, { weekday: "short" })} {pt(w.start, { hour: "numeric" })}–
                  {pt(w.start + BUCKET * 3600_000, { hour: "numeric" })}
                </b>
                <span>
                  {w.byYear.map((b) => `${b.year} ${fmtMins(b.typical)}`).join("  ·  ")}
                  {w.byYear.length < yearCount && `  ·  ${w.byYear.length}/${yearCount} YEARS ONLY`}
                </span>
              </div>
              <span className="r">{past ? "leave now" : `leave reno ${pt(leave, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}</span>
            </div>
          );
        })}
      </div>

      {worst && (
        <p className="note">
          Worst upcoming window on the same measure:{" "}
          <strong style={{ color: waitColor(worst.score) }}>
            {pt(worst.start, { weekday: "short" })} {pt(worst.start, { hour: "numeric" })}
          </strong>{" "}
          — {fmtMins(worst.score)} on this measure.{" "}
          {partial && "Some windows are scored on fewer years because the others had no reading at that hour — those are marked. "}
          &ldquo;Leave Reno&rdquo; assumes about {Math.round((DRIVE_TO_GRAVEL_MIN / 60) * 10) / 10}h to the gravel and
          does not include the queue itself. This is a historical prior, not a forecast — when the live number
          disagrees with it, believe the live number.
        </p>
      )}
    </section>
  );
}
