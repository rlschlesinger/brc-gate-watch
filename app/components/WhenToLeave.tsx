"use client";

import { useMemo } from "react";
import { fmtMins, waitColor } from "@/lib/format";
import type { Historical } from "@/lib/historical";

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
};

function labelFor(ms: number): string {
  const off = Math.floor((ms - GATE_OPEN) / 86_400_000 + 1) - 1;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: PT, weekday: "short" }).format(new Date(ms));
  return off === 0 ? "SUN open" : `${wd} ${off >= 0 ? "+" : ""}${off}`;
}

const pt = (ms: number, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PT, ...o }).format(new Date(ms));

export default function WhenToLeave({ historical, now, num }: { historical: Historical; now: number; num: string }) {
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
        if (c) byYear.push({ year: yk, typical: c.typical });
      }
      if (byYear.length === 0) continue;
      out.push({
        start, dayLabel, hour: bucket, byYear,
        low: Math.min(...byYear.map((b) => b.typical)),
        high: Math.max(...byYear.map((b) => b.typical)),
      });
    }
    return out;
  }, [historical, now]);

  if (windows.length === 0) return null;

  const yearCount = (historical.rankingYears?.length ?? Object.keys(historical.years).length);
  const rankedYears = historical.rankingYears ?? Object.keys(historical.years);

  // Only compare like with like: a window that just happens to lack a reading
  // from the bad year would otherwise sort straight to the top.
  const reachable = windows.filter((w) => w.start - DRIVE_TO_GRAVEL_MIN * 60_000 > now - 30 * 60_000);
  const full = reachable.filter((w) => w.byYear.length === yearCount);
  const pool = full.length >= 3 ? full : reachable;

  // Rank by the pessimistic case — you cannot pick which year you get.
  const ranked = [...pool].sort((a, b) => a.high - b.high || a.low - b.low).slice(0, 4);
  const worst = [...pool].sort((a, b) => b.high - a.high)[0];
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
        {rankedYears.join(", ")}. Ranked by the <em>worst</em> of those years, because you do not get to pick which
        one you are in. Thinner years in the record below are left out of the scoring.
      </p>

      <div className="rows">
        {ranked.map((w, i) => {
          const leave = w.start - DRIVE_TO_GRAVEL_MIN * 60_000;
          const past = leave < now;
          return (
            <div className="rank" key={w.start}>
              <span className="n" style={{ background: waitColor(w.high) }}>{i + 1}</span>
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
          <strong style={{ color: waitColor(worst.high) }}>
            {pt(worst.start, { weekday: "short" })} {pt(worst.start, { hour: "numeric" })}
          </strong>{" "}
          — up to {fmtMins(worst.high)}.{" "}
          {partial && "Some windows are scored on fewer years because the others had no reading at that hour — those are marked. "}
          &ldquo;Leave Reno&rdquo; assumes about {Math.round((DRIVE_TO_GRAVEL_MIN / 60) * 10) / 10}h to the gravel and
          does not include the queue itself. This is a historical prior, not a forecast — when the live number
          disagrees with it, believe the live number.
        </p>
      )}
    </section>
  );
}
