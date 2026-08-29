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

export default function WhenToLeave({ historical, now }: { historical: Historical; now: number }) {
  const windows = useMemo<Window[]>(() => {
    if (historical.status !== "ok") return [];
    const years = Object.entries(historical.years);
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

  const yearCount = Object.keys(historical.years).length;

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
    <section className="card">
      <h2>
        When to roll in
        <span className="tag">next 72h</span>
      </h2>
      <p className="sub" style={{ marginTop: 0, marginBottom: 12 }}>
        Every upcoming two-hour arrival window, scored by what that same day-and-hour actually cost in{" "}
        {historical.coverageYears.join(" and ")}. Ranked by the <em>worse</em> of the two years, because you do not
        get to pick which one you are in.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranked.map((w, i) => {
          const leave = w.start - DRIVE_TO_GRAVEL_MIN * 60_000;
          const past = leave < now;
          return (
            <div
              key={w.start}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 11px",
                borderRadius: 11, border: `1px solid ${i === 0 ? "rgba(255,158,61,.4)" : "var(--line)"}`,
                background: i === 0 ? "rgba(255,158,61,.08)" : "rgba(255,255,255,.022)",
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center",
                  background: waitColor(w.high), color: "rgba(0,0,0,.7)",
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  arrive {pt(w.start, { weekday: "short" })} {pt(w.start, { hour: "numeric" })}–
                  {pt(w.start + BUCKET * 3600_000, { hour: "numeric" })}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--sand-faint)", marginTop: 2 }}>
                  {w.byYear.map((b) => `${b.year}: ${fmtMins(b.typical)}`).join("  ·  ")}
                  {w.byYear.length < yearCount && (
                    <span style={{ color: "var(--warn)" }}> · only {w.byYear.length} of {yearCount} years</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: past ? "var(--sand-faint)" : "var(--sand-dim)" }}>
                  {past ? "leave now" : `leave Reno ${pt(leave, { weekday: "short", hour: "numeric", minute: "2-digit" })}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {worst && (
        <p className="sub">
          Worst upcoming window on the same measure: <strong style={{ color: waitColor(worst.high) }}>
            {pt(worst.start, { weekday: "short" })} {pt(worst.start, { hour: "numeric" })}
          </strong>{" "}
          — up to {fmtMins(worst.high)}.{" "}
          {partial && (
            <>Some windows below are scored on a single year because the other had no reading at that hour — those
            are marked. </>
          )}
          &ldquo;Leave Reno&rdquo; assumes about {Math.round(DRIVE_TO_GRAVEL_MIN / 60 * 10) / 10}h
          to the gravel and does not include the queue itself. This is a historical prior, not a forecast — when the
          live number disagrees with it, believe the live number.
        </p>
      )}
    </section>
  );
}
