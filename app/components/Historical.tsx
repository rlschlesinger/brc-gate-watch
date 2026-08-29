"use client";

import { useState } from "react";
import { DayBars, HeatClock, HeatGrid, Legend } from "./Charts";
import { fmtMins } from "@/lib/format";
import type { Historical } from "@/lib/historical";

export default function HistoricalSection({
  historical, nowDay, nowHour, num,
}: {
  historical: Historical; nowDay?: string; nowHour?: number; num: string;
}) {
  const yearKeys = Object.keys(historical.years ?? {});
  const [year, setYear] = useState(historical.defaultYear ?? yearKeys[0] ?? "");
  const [phase, setPhase] = useState<"arrival" | "exodus">("arrival");
  const [view, setView] = useState<"grid" | "clock">("grid");

  if (historical.status !== "ok" || yearKeys.length === 0) {
    return (
      <section className="sec">
        <div className="sec-hd"><div className="l"><span className="sec-num">{num}</span><h2>How bad it was</h2></div></div>
        <p className="lede">Historical dataset is still being assembled from past-year reports.</p>
      </section>
    );
  }

  const y = historical.years[year];
  const block = phase === "arrival" ? y.arrival : y.exodus;
  const days = block.days.map((d) => d.label);

  return (
    <>
      <section className="sec">
        <div className="sec-hd">
          <div className="l">
            <span className="sec-num">{num}</span>
            <h2>How bad it was</h2>
          </div>
          <div className="seg">
            {(["grid", "clock"] as const).map((v) => (
              <button key={v} data-on={view === v ? "1" : "0"} onClick={() => setView(v)}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div className="seg wrap" style={{ marginBottom: 10 }}>
          {yearKeys.map((k) => (
            <button key={k} data-on={year === k ? "1" : "0"} onClick={() => setYear(k)}>{k}</button>
          ))}
        </div>
        <div className="seg wrap" style={{ marginBottom: 14 }}>
          {(["arrival", "exodus"] as const).map((p) => {
            const empty = (p === "arrival" ? y.arrival : y.exodus).days.length === 0;
            return (
              <button
                key={p} data-on={phase === p ? "1" : "0"} onClick={() => setPhase(p)}
                style={empty ? { opacity: 0.45 } : undefined}
                title={empty ? `no ${p} readings recovered for ${year}` : undefined}
              >
                {p.toUpperCase()}
              </button>
            );
          })}
        </div>

        <p className="lede"><strong style={{ color: "var(--ink)" }}>{year}.</strong> {y.note}</p>

        {block.days.length === 0 ? (
          <p className="lede">No {phase} readings were recovered for {year}.</p>
        ) : view === "grid" ? (
          <HeatGrid
            days={days} cells={block.cells} bucket={2}
            nowDay={phase === "arrival" ? nowDay : undefined} nowHour={nowHour}
          />
        ) : (
          <HeatClock days={days} cells={block.cells} nowHour={phase === "arrival" ? nowHour : undefined} />
        )}

        <Legend />

        <p className="note">
          Median Gravel-to-Gate time by day and hour, from {block.days.reduce((a, d) => a + d.n, 0)} hourly
          @bmantraffic readings. Rows are days relative to gate open, so they line up across years. Blank means
          nobody reported. The wording of the official posts changed between years, so the measured stretch of road
          is not identical year to year — compare shapes, not decimals.
        </p>
      </section>

      {block.days.length > 0 && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l">
              <span className="sec-num">{String(Number(num) + 1).padStart(2, "0")}</span>
              <h2>{year} by {phase === "arrival" ? "arrival" : "departure"} day</h2>
            </div>
          </div>
          <DayBars rows={block.days.map((d) => ({ label: d.label, typical: d.typical, peak: d.peak, note: d.note }))} />
          <p className="note">
            Solid bar is the median for the day; the faint bar behind it is that day&rsquo;s worst reading. Best case
            seen was {fmtMins(Math.min(...block.days.map((d) => d.floor)))}, worst{" "}
            {fmtMins(Math.max(...block.days.map((d) => d.peak)))}. Each year is a separate scenario, not a trend —
            weather and gate staffing differed. Do not read them as a curve.
          </p>
        </section>
      )}

      {historical.insights.length > 0 && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l">
              <span className="sec-num">{String(Number(num) + 2).padStart(2, "0")}</span>
              <h2>The record</h2>
            </div>
          </div>
          <div className="stream">
            {historical.insights.slice(0, 14).map((h, i) => (
              <div className="it" key={i}>
                <p>{h.text}</p>
                {h.sourceUrl && (
                  <div className="meta">
                    {h.years?.length ? <span>{h.years.join(", ")}</span> : null}
                    <a href={h.sourceUrl} target="_blank" rel="noreferrer">source ↗</a>
                  </div>
                )}
              </div>
            ))}
          </div>
          {historical.primarySource && (
            <p className="note">
              Hourly series from{" "}
              <a href={historical.primarySource.url} target="_blank" rel="noreferrer">{historical.primarySource.title}</a>,
              cross-checked reading-by-reading against tweet timestamps.
            </p>
          )}
        </section>
      )}
    </>
  );
}
