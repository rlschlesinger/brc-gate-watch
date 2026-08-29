"use client";

import { useState } from "react";
import { DayBars, Heatmap } from "./Charts";
import { fmtMins } from "@/lib/format";
import type { Historical } from "@/lib/historical";

export default function HistoricalSection({
  historical, nowDay, nowHour,
}: {
  historical: Historical; nowDay?: string; nowHour?: number;
}) {
  const yearKeys = Object.keys(historical.years ?? {});
  const [year, setYear] = useState(historical.defaultYear ?? yearKeys[0] ?? "");
  const [phase, setPhase] = useState<"arrival" | "exodus">("arrival");

  if (historical.status !== "ok" || yearKeys.length === 0) {
    return (
      <section className="card">
        <h2>How bad is it usually</h2>
        <p className="sub">Historical dataset is still being assembled from past-year reports.</p>
      </section>
    );
  }

  const y = historical.years[year];
  const block = phase === "arrival" ? y.arrival : y.exodus;
  const days = block.days.map((d) => d.label);

  return (
    <>
      <section className="card">
        <h2>
          How bad it actually was
          <span className="tag">{historical.coverageYears.join(" · ")}</span>
        </h2>

        <div className="tabs" style={{ marginTop: 0, marginBottom: 6 }}>
          {yearKeys.map((k) => (
            <button key={k} data-on={year === k ? "1" : "0"} onClick={() => setYear(k)}>{k}</button>
          ))}
        </div>
        <div className="tabs" style={{ marginTop: 0, marginBottom: 6 }}>
          {(["arrival", "exodus"] as const).map((p) => {
            const empty = (p === "arrival" ? y.arrival : y.exodus).days.length === 0;
            return (
              <button
                key={p} data-on={phase === p ? "1" : "0"} onClick={() => setPhase(p)}
                style={empty ? { opacity: 0.42 } : undefined}
                title={empty ? `no ${p} readings recovered for ${year}` : undefined}
              >
                {p}{empty ? " ·" : ""}
              </button>
            );
          })}
        </div>

        <p className="sub" style={{ marginTop: 0, marginBottom: 12 }}>
          <strong style={{ color: "var(--sand)" }}>{year}:</strong> {y.note}
        </p>

        {block.days.length === 0 ? (
          <p className="sub">No {phase} readings were recovered for {year}.</p>
        ) : block.cells.length > 0 ? (
          <Heatmap
            days={days} cells={block.cells} bucket={2}
            nowDay={phase === "arrival" ? nowDay : undefined} nowHour={nowHour}
          />
        ) : (
          <p className="sub">No hourly readings recovered for {year} {phase}.</p>
        )}
        <p className="sub">
          Median Gravel-to-Gate time by day and hour of arrival, from {y.arrival.days.reduce((a, d) => a + d.n, 0)}{" "}
          hourly @bmantraffic readings. Rows are days relative to gate open, so they line up across years. Blank
          cells are hours nobody reported.
        </p>
      </section>

      {block.days.length > 0 && (
      <section className="card">
        <h2>{year} · wait by {phase === "arrival" ? "arrival" : "departure"} day</h2>
        <DayBars
          rows={block.days.map((d) => ({
            label: d.label, typical: d.typical, peak: d.peak, note: d.note,
          }))}
        />
        <p className="sub">
          Solid bar is the median for the day; the faint bar behind it is that day&rsquo;s worst reading. Best case
          seen was {fmtMins(Math.min(...block.days.map((d) => d.floor)))}, worst{" "}
          {fmtMins(Math.max(...block.days.map((d) => d.peak)))}.
        </p>
      </section>
      )}

      {historical.insights.length > 0 && (
        <section className="card">
          <h2>What the record says</h2>
          <div className="feed">
            {historical.insights.slice(0, 14).map((h, i) => (
              <div className="item" key={i}>
                <div className="body">
                  {h.text}
                  {h.sourceUrl && (
                    <div className="meta">
                      {h.years?.length ? `${h.years.join(", ")} · ` : ""}
                      <a href={h.sourceUrl} target="_blank" rel="noreferrer">source ↗</a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {historical.primarySource && (
            <p className="sub">
              Hourly series from{" "}
              <a href={historical.primarySource.url} target="_blank" rel="noreferrer">
                {historical.primarySource.title}
              </a>
              , cross-checked against tweet timestamps. Statements above are quoted from the sources linked on each.
            </p>
          )}
        </section>
      )}
    </>
  );
}
