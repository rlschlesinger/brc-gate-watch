"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayBars, Heatmap, LiveChart } from "./components/Charts";
import { ago, fmtMins, waitColor } from "@/lib/format";
import type { Historical } from "@/lib/historical";
import type { LivePayload, WaitSample } from "@/lib/types";

type Live = LivePayload & { archiveUpdatedAt?: string; archiveCount?: number };

const PT = "America/Los_Angeles";
const GATE_OPEN = Date.parse("2026-08-30T07:01:00.000Z"); // 12:01am Sun, Pacific
const CACHE_KEY = "gatewatch:last";
const REFRESH_MS = 60_000;

const DUST_LABEL: Record<string, string> = {
  calm: "calm", dusty: "dusty", whiteout: "whiteout risk", unknown: "unknown",
};
const DUST_COLOR: Record<string, string> = {
  calm: "var(--ok)", dusty: "var(--warn)", whiteout: "var(--crit)", unknown: "var(--sand-faint)",
};

const pt = (d: Date | string | number, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: PT, ...o }).format(new Date(d));

export default function Dashboard({ historical }: { historical: Historical }) {
  const [live, setLive] = useState<Live | null>(null);
  const [archive, setArchive] = useState<WaitSample[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(24);
  const [now, setNow] = useState(() => Date.now());
  const [camKey, setCamKey] = useState(() => Date.now());
  const inflight = useRef(false);

  /* -------------------------------------------------- load + auto-refresh */

  const load = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await fetch("/api/live", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j: Live = await r.json();
      setLive(j);
      setErr(null);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: j }));
      } catch { /* private mode */ }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "offline");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Paint immediately from the last good response — signal on the 447 is bad.
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { data } = JSON.parse(raw);
        if (data) { setLive(data); setLoading(false); }
      }
    } catch { /* ignore */ }

    load();
    fetch("/api/history", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.samples && setArchive(j.samples))
      .catch(() => {});

    const iv = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const cams = setInterval(() => setCamKey(Date.now()), 90_000);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", load);
    return () => {
      clearInterval(iv); clearInterval(tick); clearInterval(cams);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", load);
    };
  }, [load]);

  /* ------------------------------------------------------------ derived */

  const samples = useMemo(() => {
    const byKey = new Map<string, WaitSample>();
    for (const s of [...archive, ...(live?.toc ?? [])]) byKey.set(s.at, s);
    return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
  }, [archive, live]);

  const current = live?.current ?? { minutes: null, at: null, source: null };

  const trend = useMemo(() => {
    const recent = samples.slice(-6);
    if (recent.length < 3 || current.minutes === null) return null;
    const prior = recent.slice(0, -1);
    const avg = prior.reduce((a, s) => a + s.minutes, 0) / prior.length;
    const delta = current.minutes - avg;
    if (Math.abs(delta) < 12) return { dir: "flat" as const, delta };
    return { dir: delta > 0 ? ("up" as const) : ("down" as const), delta };
  }, [samples, current.minutes]);

  const stats = useMemo(() => {
    const last24 = samples.filter((s) => Date.now() - new Date(s.at).getTime() < 86_400_000);
    if (!last24.length) return null;
    const vals = last24.map((s) => s.minutes).sort((a, b) => a - b);
    const best = last24.reduce((a, b) => (a.minutes <= b.minutes ? a : b));
    const worst = last24.reduce((a, b) => (a.minutes >= b.minutes ? a : b));
    return {
      median: vals[Math.floor(vals.length / 2)],
      best, worst, n: last24.length,
    };
  }, [samples]);

  const freshness = live ? now - Date.parse(live.fetchedAt) : Infinity;
  const dotClass = err || freshness > 10 * 60_000 ? (err ? "dead" : "stale") : "";

  const countdown = useMemo(() => {
    const ms = GATE_OPEN - now;
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600_000);
    const m = Math.floor((ms % 3600_000) / 60_000);
    return `${h}h ${m}m`;
  }, [now]);

  const verdict = buildVerdict({ current, trend, countdown, stats, live, now });

  const nowDay = pt(now, { weekday: "short" });
  const nowHour = Number(pt(now, { hour: "numeric", hour12: false }).replace(/\D/g, "")) % 24;

  const alerts = live?.nws?.alerts ?? [];

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="mark">GATE<b>WATCH</b> · BRC 2026</div>
          <div className="pulse">
            <span className={`dot ${dotClass}`} />
            {err ? "offline — showing last known" : loading ? "loading" : `updated ${ago(live?.fetchedAt, now)}`}
          </div>
        </div>
      </header>

      <main className="wrap">
        {/* ------------------------------------------------------- hero */}
        <section className="hero">
          <div className="lab">Gravel Pit → Gate · current travel time</div>
          <div className="big">
            <span className="n" style={{ color: current.minutes === null ? "var(--sand-faint)" : waitColor(current.minutes) }}>
              {current.minutes === null ? "—" : fmtMins(current.minutes)}
            </span>
            {trend && (
              <span className={`trend ${trend.dir}`}>
                {trend.dir === "up" ? "▲ rising" : trend.dir === "down" ? "▼ falling" : "— steady"}
                {trend.dir !== "flat" && ` ${Math.abs(Math.round(trend.delta))}m`}
              </span>
            )}
          </div>
          <div className="lab" style={{ opacity: 0.85 }}>
            {current.at
              ? `reported ${pt(current.at, { weekday: "short", hour: "numeric", minute: "2-digit" })} PT · ${ago(current.at, now)} · via ${current.source === "toc" ? "BRC Gate crossing table" : "@bmantraffic"}`
              : "no report yet"}
            {countdown && ` · gate opens in ${countdown}`}
          </div>
          <div className="verdict" dangerouslySetInnerHTML={{ __html: verdict }} />
        </section>

        {/* ----------------------------------------------------- alerts */}
        {alerts.map((a, i) => (
          <div key={i} className={`alert ${/warning|severe|extreme/i.test(a.severity + a.event) ? "crit" : "warn"}`}>
            <div className="h">⚠ {a.event}</div>
            <div>{a.headline}</div>
          </div>
        ))}
        {live?.banners?.map((b) => (
          <div key={b.id} className={`alert ${b.severity === "critical" ? "crit" : b.color === "red" ? "warn" : "info"}`}>
            {b.title && <div className="h">{b.title}</div>}
            <div>{b.content}</div>
          </div>
        ))}

        {/* --------------------------------------------------- 24h stats */}
        {stats && (
          <div className="grid2">
            <div className="stat">
              <div className="k">Median, last 24h</div>
              <div className="v">{fmtMins(stats.median)} <small>· {stats.n} readings</small></div>
            </div>
            <div className="stat">
              <div className="k">Best / worst window</div>
              <div className="v" style={{ fontSize: 15 }}>
                {fmtMins(stats.best.minutes)} <small>at {pt(stats.best.at, { hour: "numeric" })}</small>
                {" · "}
                {fmtMins(stats.worst.minutes)} <small>at {pt(stats.worst.at, { hour: "numeric" })}</small>
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- live chart */}
        <section className="card">
          <h2>
            Live wait — recorded
            <span className="tag">{samples.length} pts</span>
          </h2>
          <div className="tabs" style={{ marginTop: 0, marginBottom: 10 }}>
            {[6, 12, 24, 72].map((h) => (
              <button key={h} data-on={range === h ? "1" : "0"} onClick={() => setRange(h)}>
                {h}h
              </button>
            ))}
          </div>
          <LiveChart samples={samples} hours={range} />
          <p className="sub">
            Every point is an official reading — the half-hourly crossing-time table on the BRC Dashboard, or an
            hourly @bmantraffic post. Both are published as rolling windows and then discarded; this chart is the
            archive built by polling them.
          </p>
        </section>

        {/* --------------------------------------------------- historical */}
        <section className="card">
          <h2>
            How bad is it usually
            {historical.coverageYears.length > 0 && (
              <span className="tag">{historical.coverageYears.join(" · ")}</span>
            )}
          </h2>
          {historical.status === "pending" || historical.cells.length === 0 ? (
            <p className="sub">
              Historical dataset is still being assembled from past-year reports. Once it lands, this becomes a
              day × hour map of what the wait actually was.
            </p>
          ) : (
            <>
              <Heatmap days={historical.days} cells={historical.cells} bucket={2} nowDay={nowDay} nowHour={nowHour} />
              <p className="sub">
                Typical reported Gravel-to-Gate time by day of the event and hour of arrival, pooled across{" "}
                {historical.coverageYears.join(", ")}. Blank cells mean nobody reported. The white outline is right now.
              </p>
            </>
          )}
        </section>

        {historical.byDay.length > 0 && (
          <section className="card">
            <h2>Wait by arrival day</h2>
            <DayBars rows={historical.byDay} />
          </section>
        )}

        {historical.insights.length > 0 && (
          <section className="card">
            <h2>What past years say</h2>
            <div className="feed">
              {historical.insights.map((h, i) => (
                <div className="item" key={i}>
                  <div className="body">
                    {h.text}
                    {h.sourceUrl && (
                      <div className="meta">
                        <a href={h.sourceUrl} target="_blank" rel="noreferrer">source ↗</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --------------------------------------------------- conditions */}
        {live?.conditions && (
          <section className="card">
            <h2>
              On the playa right now
              <span className="tag">open-meteo</span>
            </h2>
            <div className="grid2" style={{ gap: 10 }}>
              <div className="stat">
                <div className="k">Wind / gusts</div>
                <div className="v">
                  {live.conditions.windMph !== null ? Math.round(live.conditions.windMph) : "—"}
                  <small> mph</small>
                  {live.conditions.gustMph !== null && (
                    <small style={{ color: live.conditions.gustMph >= 25 ? "var(--warn)" : undefined }}>
                      {" "}· gusting {Math.round(live.conditions.gustMph)}
                    </small>
                  )}
                </div>
              </div>
              <div className="stat">
                <div className="k">Visibility · dust</div>
                <div className="v">
                  {live.conditions.visibilityMi !== null ? `${live.conditions.visibilityMi} mi` : "—"}{" "}
                  <small style={{ color: DUST_COLOR[live.conditions.dust] }}>· {DUST_LABEL[live.conditions.dust]}</small>
                </div>
              </div>
            </div>
            <p className="sub">
              Visibility is a modelled value, not a dust sensor — there is no public air-quality station near Gerlach.
              Treat it as a hint, and believe the cameras and the Gate over it.
            </p>
          </section>
        )}

        {/* ----------------------------------------------------- cameras */}
        {live?.cameras && live.cameras.length > 0 && (
          <section className="card">
            <h2>Cameras on the route<span className="tag">refreshes 90s</span></h2>
            <div style={{ display: "grid", gap: 14 }}>
              {live.cameras.filter((c) => c.ok !== false || c.ageSec !== null).map((c) => {
                const stale = c.ageSec !== null && c.ageSec > 20 * 60;
                return (
                  <figure key={c.id} style={{ margin: 0 }}>
                    <div style={{ position: "relative" }}>
                      <img
                        src={`/api/cam/${c.id}?t=${camKey}`}
                        alt={c.label}
                        loading="lazy"
                        style={{
                          width: "100%", borderRadius: 10, display: "block",
                          border: `1px solid ${stale ? "rgba(242,193,78,.45)" : "var(--line)"}`,
                          background: "rgba(255,255,255,.03)",
                          filter: stale ? "grayscale(.55) brightness(.72)" : undefined,
                        }}
                        onError={(e) => { (e.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }}
                      />
                      {c.ageSec !== null && (
                        <span
                          style={{
                            position: "absolute", top: 8, left: 8,
                            fontFamily: "var(--mono)", fontSize: 10.5, padding: "3px 8px", borderRadius: 999,
                            background: stale ? "rgba(242,193,78,.92)" : "rgba(13,10,7,.8)",
                            color: stale ? "#241b11" : "var(--sand)",
                            fontWeight: stale ? 700 : 400,
                            border: stale ? "none" : "1px solid var(--line)",
                          }}
                        >
                          {stale ? `⚠ frame is ${fmtMins(c.ageSec / 60)} old` : `live · ${fmtMins(c.ageSec / 60)} old`}
                        </span>
                      )}
                    </div>
                    <figcaption style={{ fontSize: 12, color: "var(--sand-faint)", marginTop: 6 }}>
                      <strong style={{ color: "var(--sand-dim)" }}>{c.label}</strong> — {c.where}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            <p className="sub">
              Age comes from the camera host&rsquo;s own <code>Last-Modified</code>. A frame older than 20 minutes is
              dimmed and flagged — Bruno&rsquo;s in particular serves hours-old frames with a broken on-image clock, so
              ignore the timestamp burned into the picture.
            </p>
          </section>
        )}

        {/* ------------------------------------------------------ weather */}
        {live?.forecasts && live.forecasts.length > 0 && (
          <section className="card">
            <h2>Playa forecast<span className="tag">NWS Reno</span></h2>
            <div className="wx">
              {live.forecasts.map((f) => (
                <div className="d" key={f.date}>
                  <div className="dd">{pt(`${f.date}T18:00:00Z`, { weekday: "short", month: "numeric", day: "numeric" })}</div>
                  <div className="t">{f.high}° <small>/ {f.low}°</small></div>
                  {f.gust && <div className="g">gusts {f.gust} mph {f.windDirection ?? ""}</div>}
                  <div className="sub" style={{ fontSize: 11.5, marginTop: 5 }}>{f.message}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ traffic */}
        {live?.traffic && live.traffic.length > 0 && (
          <section className="card">
            <h2>@bmantraffic<span className="tag">official</span></h2>
            <div className="feed">
              {live.traffic.slice(0, 14).map((t) => (
                <div className="item" key={t.id}>
                  <div className="when">{pt(t.createdAt, { hour: "numeric", minute: "2-digit" })}</div>
                  <div className="body">
                    {t.text}
                    {t.minutes !== null && (
                      <div className="meta">
                        <span className="pill" style={{ color: waitColor(t.minutes), borderColor: "currentColor" }}>
                          {fmtMins(t.minutes)}
                        </span>
                        {pt(t.createdAt, { weekday: "short" })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------ chatter */}
        {live?.social && live.social.length > 0 && (
          <section className="card">
            <h2>Road chatter<span className="tag">unverified</span></h2>
            <div className="feed">
              {live.social.slice(0, 12).map((p) => (
                <div className="item" key={p.id}>
                  <div className="when">{pt(p.createdAt, { hour: "numeric", minute: "2-digit" })}</div>
                  <div className="body">
                    <a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                    <div className="meta">
                      <span className="pill">{p.network}</span>
                      {p.author} · {ago(p.createdAt, now)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="sub">
              Posts from r/BurningMan and Bluesky matching gate / traffic / road keywords. These are strangers on the
              internet, not the Gate — treat them as rumour until the official numbers agree.
            </p>
          </section>
        )}

        {/* ------------------------------------------------------- health */}
        <section className="card">
          <h2>Source status</h2>
          <div className="health">
            {Object.entries(live?.sourceHealth ?? {}).map(([k, v]) => (
              <span className={`chip ${v}`} key={k}><i />{k.replace(/_/g, " ")} · {v}</span>
            ))}
            {!live && <span className="chip"><i />waiting for first response</span>}
          </div>
          <p className="sub">
            &ldquo;empty&rdquo; means the source answered but had nothing to say; &ldquo;error&rdquo; means it refused or timed out.
            Nothing here is synthesised — if a source is down, its panel disappears rather than showing a guess.
          </p>
        </section>

        <footer className="f">
          <strong>Gate Watch</strong> reads the same public feeds as{" "}
          <a href="https://brcdashboard.burningman.org/" target="_blank" rel="noreferrer">brcdashboard.burningman.org</a>{" "}
          and keeps the history they throw away. Travel times are Gravel Pit → Gate and exclude the drive from Reno
          (~2h 15m to Gerlach) and the crawl through Greeters.
          <br />
          All times Pacific. Refreshes every 60s while open; last good response is cached for when you lose signal.
          {live?.archiveUpdatedAt && ` Archive: ${live.archiveCount ?? 0} readings.`}
          <br />
          Not affiliated with Burning Man Project.
        </footer>
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ verdict */

function buildVerdict({
  current, trend, countdown, stats, live, now,
}: {
  current: { minutes: number | null; at: string | null; source: string | null };
  trend: { dir: "up" | "down" | "flat"; delta: number } | null;
  countdown: string | null;
  stats: { median: number; best: WaitSample; worst: WaitSample; n: number } | null;
  live: Live | null;
  now: number;
}): string {
  if (!live) return "Waiting for the first reading from the BRC Dashboard…";
  if (current.minutes === null) {
    return countdown
      ? `No travel time posted yet. Gate opens in <b>${countdown}</b> — readings normally start once the queue forms.`
      : "No travel time posted right now. The Gate publishes these hourly during arrival.";
  }

  const staleMin = current.at ? (now - Date.parse(current.at)) / 60_000 : 0;
  const parts: string[] = [];

  const m = current.minutes;
  if (m <= 30) parts.push("The line is <b>essentially moving</b>.");
  else if (m <= 90) parts.push("A <b>normal</b> wait — under an hour and a half.");
  else if (m <= 180) parts.push("A <b>real</b> wait. Fuel, water and a bathroom plan before Gerlach.");
  else if (m <= 360) parts.push("A <b>long</b> wait. Do not get in this line low on fuel or water.");
  else parts.push("This is a <b>brutal</b> wait. Consider sleeping in Reno or Gerlach and re-checking.");

  if (trend?.dir === "up") parts.push("It has been getting worse over the last few readings.");
  else if (trend?.dir === "down") parts.push("It has been easing over the last few readings.");

  if (stats && stats.n >= 4) {
    const best = new Intl.DateTimeFormat("en-US", { timeZone: PT, hour: "numeric" }).format(new Date(stats.best.at));
    parts.push(`Over the last 24h the shortest reading was <b>${fmtMins(stats.best.minutes)}</b> around ${best}.`);
  }

  if (countdown) parts.push(`Gate opens in <b>${countdown}</b>.`);
  if (staleMin > 90) parts.push(`<em>This reading is ${Math.round(staleMin / 60)}h old — the Gate has not posted since.</em>`);

  return parts.join(" ");
}
