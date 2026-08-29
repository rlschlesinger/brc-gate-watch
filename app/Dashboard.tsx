"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveChart } from "./components/Charts";
import HistoricalSection from "./components/Historical";
import WhenToLeave from "./components/WhenToLeave";
import ThemeToggle from "./components/ThemeToggle";
import { ago, fmtClock, fmtMins, waitColor, waitWord } from "@/lib/format";
import type { Historical } from "@/lib/historical";
import type { LivePayload, WaitSample } from "@/lib/types";

type Live = LivePayload & { archiveUpdatedAt?: string; archiveCount?: number };

const PT = "America/Los_Angeles";
const GATE_OPEN = Date.parse("2026-08-30T07:01:00.000Z"); // 12:01am Sun, Pacific
const CACHE_KEY = "gatewatch:last";
const REFRESH_MS = 60_000;

type TabId = "now" | "plan" | "road" | "feed" | "info";
const TABS: { id: TabId; label: string }[] = [
  { id: "now", label: "NOW" },
  { id: "plan", label: "PLAN" },
  { id: "road", label: "ROAD" },
  { id: "feed", label: "FEED" },
  { id: "info", label: "INFO" },
];

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
  const [tab, setTab] = useState<TabId>("now");
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
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: j })); } catch { /* private mode */ }
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

    // Deep-linkable tabs, so a shared link opens where the sender meant.
    const fromHash = () => {
      const h = window.location.hash.replace("#", "") as TabId;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);

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
      window.removeEventListener("hashchange", fromHash);
    };
  }, [load]);

  /* ------------------------------------------------------------- derived */

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
    return {
      median: vals[Math.floor(vals.length / 2)],
      best: last24.reduce((a, b) => (a.minutes <= b.minutes ? a : b)),
      worst: last24.reduce((a, b) => (a.minutes >= b.minutes ? a : b)),
      n: last24.length,
    };
  }, [samples]);

  const freshness = live ? now - Date.parse(live.fetchedAt) : Infinity;
  const feedState: "live" | "stale" | "offline" | "connecting" =
    err ? "offline" : !live ? "connecting" : freshness > 10 * 60_000 ? "stale" : "live";
  const feedColor =
    feedState === "live" ? "var(--r1)" : feedState === "connecting" ? "var(--rule)"
    : feedState === "stale" ? "var(--r3)" : "var(--r5)";

  const countdown = useMemo(() => {
    const ms = GATE_OPEN - now;
    if (ms <= 0) return null;
    return `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60_000)}m`;
  }, [now]);

  const nowHour = Number(pt(now, { hour: "numeric", hour12: false }).replace(/\D/g, "")) % 24;
  const alerts = live?.nws?.alerts ?? [];
  const staleCam = live?.cameras?.find((c) => c.ageSec !== null && c.ageSec > 20 * 60);
  const urgentCount = alerts.length + (live?.flags?.placeholderMode ? 1 : 0) + (live?.banners?.length ?? 0);

  const go = useCallback((id: TabId) => {
    setTab(id);
    try { history.replaceState(null, "", id === "now" ? " " : `#${id}`); } catch { /* file:// */ }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <div className="shell">
      <div className="topbar">
        <header className="hdr">
          <div className="brand">
            <b>Gate Watch</b>
            <span className="coord">BLACK ROCK CITY · 40.7864° N</span>
          </div>
          <ThemeToggle />
        </header>

        <nav className="tabbar" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-on={tab === t.id ? "1" : "0"}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => go(t.id)}
            >
              <span className="pip" />
              {t.label}
              {t.id === "road" && staleCam && <span className="flag" title="a camera frame is stale" />}
              {t.id === "now" && urgentCount > 0 && <span className="flag" title="active alert" />}
            </button>
          ))}
        </nav>

        {tab !== "now" && (
          <div className="strip">
            <b style={{ color: waitColor(current.minutes) }}>{fmtClock(current.minutes)}</b>
            <span className="w" style={{ color: waitColor(current.minutes) }}>{waitWord(current.minutes)}</span>
            <span className="t">
              gravel → gate<br />
              {err ? "offline" : loading ? "loading" : ago(live?.fetchedAt, now)}
            </span>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- notices */}
      {live?.flags?.placeholderMode && (
        <div className="notice">
          <s style={{ color: "var(--r5)" }}>!</s>
          <p>
            <strong>Official dashboard is in placeholder mode.</strong>
            <span> Burning Man has switched brcdashboard.burningman.org to demo data. The travel time above is not a real reading until they switch it back.</span>
          </p>
        </div>
      )}
      {current.minutes !== null && current.at && now - Date.parse(current.at) > 90 * 60_000 && (
        <div className="notice">
          <s style={{ color: "var(--r3)" }}>!</s>
          <p>
            <strong>Reading is {fmtMins((now - Date.parse(current.at)) / 60_000)} old.</strong>
            <span> The Gate has not posted since. Treat the number above as the last thing they said, not as now.</span>
          </p>
        </div>
      )}
      {alerts.map((a, i) => (
        <div className="notice" key={i}>
          <s style={{ color: "var(--r5)" }}>!</s>
          <p><strong>{a.event}.</strong> <span>{a.headline}</span></p>
        </div>
      ))}

      {tab === "now" && (
        <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero">
        <div className="hero-top">
          <span className="kicker">TRAVEL TIME · GRAVEL PIT → GATE</span>
          <span className="kicker thin">
            {pt(now, { hour: "2-digit", minute: "2-digit", hour12: false })} PT ·{" "}
            {err ? "OFFLINE — LAST KNOWN" : loading ? "LOADING" : `UPDATED ${ago(live?.fetchedAt, now).toUpperCase()}`}
          </span>
        </div>

        <div className={`hero-num${current.minutes === null ? " dim" : ""}`}>{fmtClock(current.minutes)}</div>

        <div className="hero-bot">
          <span className="kicker">
            HOURS : MINUTES
            {trend && trend.dir !== "flat" && ` · ${trend.dir === "up" ? "RISING" : "FALLING"} ${Math.abs(Math.round(trend.delta))}M`}
            {trend?.dir === "flat" && " · STEADY"}
          </span>
          <div className="verdict-word">
            <i style={{ background: waitColor(current.minutes) }} />
            <b style={{ color: waitColor(current.minutes) }}>{waitWord(current.minutes)}</b>
          </div>
        </div>

        <div className="chips">
          <span className="chip">
            <i style={{ background: feedColor }} />
            BRC FEED · {feedState}
          </span>
          {live?.cameras?.map((c) => (
            <span className="chip" key={c.id}>
              <i style={{ background: c.ageSec === null ? "var(--rule)" : c.ageSec > 1200 ? "var(--r3)" : "var(--r1)" }} />
              {c.label} · {c.ageSec === null ? "no timestamp" : c.ageSec > 1200 ? `stale ${fmtMins(c.ageSec / 60)}` : "live"}
            </span>
          ))}
          {live?.bmir?.onAir && (
            <span className="chip"><i style={{ background: "var(--r1)" }} />BMIR 94.5 · {live.bmir.onAir.dj}</span>
          )}
          {live?.social && live.social.length > 0 && (
            <span className="chip chip--dash">SOCIAL · UNVERIFIED</span>
          )}
        </div>
      </section>

      {live?.banners?.map((b) => (
        <div className="notice" key={b.id}>
          <s style={{ color: b.severity === "critical" ? "var(--r5)" : "var(--r3)" }}>!</s>
          <p>{b.title && <strong>{b.title}.</strong>} <span>{b.content}</span></p>
        </div>
      ))}
      {countdown && (
        <div className="notice">
          <s style={{ color: "var(--ink2)" }}>›</s>
          <p><strong>Gate opens in {countdown}.</strong> <span>12:01am Sunday 30 August, Pacific.</span></p>
        </div>
      )}

      {/* ----------------------------------------------------- 01 recorded */}
      <section className="sec">
        <div className="sec-hd">
          <div className="l">
            <span className="sec-num">01</span>
            <h2>Last {range} hours</h2>
          </div>
          <div className="seg">
            {[6, 12, 24, 72].map((h) => (
              <button key={h} data-on={range === h ? "1" : "0"} onClick={() => setRange(h)}>{h}H</button>
            ))}
          </div>
        </div>
        <LiveChart samples={samples} hours={range} />
        {stats && (
          <div className="stats" style={{ marginTop: 20 }}>
            <div className="statc" style={{ borderTopColor: waitColor(stats.median) }}>
              <div className="k">Median · last 24h</div>
              <div className="v">{fmtClock(stats.median)}</div>
              <div className="s">{stats.n} readings</div>
            </div>
            <div className="statc" style={{ borderTopColor: waitColor(stats.best.minutes) }}>
              <div className="k">Best · last 24h</div>
              <div className="v">{fmtClock(stats.best.minutes)}</div>
              <div className="s">at {pt(stats.best.at, { hour: "numeric" })}</div>
            </div>
            <div className="statc" style={{ borderTopColor: waitColor(stats.worst.minutes) }}>
              <div className="k">Worst · last 24h</div>
              <div className="v">{fmtClock(stats.worst.minutes)}</div>
              <div className="s">at {pt(stats.worst.at, { hour: "numeric" })}</div>
            </div>
          </div>
        )}
        <p className="note">
          Every reading is official — the half-hourly crossing-time table on the BRC Dashboard, or an hourly
          @bmantraffic post. Both are published as rolling windows and then discarded; this is the archive built by
          polling them. {live?.archiveCount ? `${live.archiveCount} readings kept.` : ""}
        </p>
      </section>

        </>
      )}

      {tab === "plan" && (
        <>
          <WhenToLeave historical={historical} now={now} num="01" />
          <HistoricalSection historical={historical} nowDay={histDayLabel(now)} nowHour={nowHour} num="02" />
        </>
      )}

      {tab === "road" && (
        <>
      {staleCam && (
        <div className="notice">
          <s style={{ color: "var(--r3)" }}>!</s>
          <p>
            <strong>{staleCam.label} last frame {fmtMins((staleCam.ageSec ?? 0) / 60)} ago.</strong>
            <span> The camera is not proof of current conditions. Trust the travel time and the radio over the image.</span>
          </p>
        </div>
      )}
      {/* -------------------------------------------------- 06 gate status */}
      <section className="sec">
        <div className="sec-hd">
          <div className="l"><span className="sec-num">01</span><h2>Gate lanes</h2></div>
          <span className="chip chip--dash">{live?.flags?.gateVisible ? "reporting" : "not yet reporting"}</span>
        </div>
        {live?.flags?.gateVisible && live?.gate ? (
          <div className="stats">
            <div className="statc" style={{ borderTopColor: "var(--ink)" }}>
              <div className="k">Inbound</div>
              <div className="v" style={{ fontSize: 30 }}>{live.gate.inbound ?? "—"}</div>
            </div>
            <div className="statc" style={{ borderTopColor: "var(--ink)" }}>
              <div className="k">Outbound</div>
              <div className="v" style={{ fontSize: 30 }}>{live.gate.outbound ?? "—"}</div>
            </div>
            {live.gate.status && (
              <div className="statc" style={{ borderTopColor: "var(--ink)" }}>
                <div className="k">Status</div>
                <div className="v" style={{ fontSize: 30 }}>{live.gate.status}</div>
              </div>
            )}
          </div>
        ) : (
          <p className="lede">
            The Gate publishes open/closed lane status on its own switch and has it turned off right now — the
            endpoint is live and returning nulls, not broken. This fills in the moment they flip it on, usually
            around gate open.
          </p>
        )}
      </section>

      {/* -------------------------------------------------- 07 conditions */}
      {live?.conditions && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">02</span><h2>On the playa</h2></div>
            <span className="chip chip--dash">open-meteo</span>
          </div>
          <div className="stats">
            <div className="statc" style={{ borderTopColor: (live.conditions.gustMph ?? 0) >= 25 ? "var(--r3)" : "var(--r1)" }}>
              <div className="k">Wind</div>
              <div className="v">{live.conditions.windMph !== null ? Math.round(live.conditions.windMph) : "—"}</div>
              <div className="s">mph{live.conditions.gustMph !== null ? ` · gusting ${Math.round(live.conditions.gustMph)}` : ""}</div>
            </div>
            <div className="statc" style={{ borderTopColor: DUST_COLOR[live.conditions.dust] }}>
              <div className="k">Visibility</div>
              <div className="v">{live.conditions.visibilityMi ?? "—"}</div>
              <div className="s">miles · {live.conditions.dust}</div>
            </div>
            <div className="statc" style={{ borderTopColor: "var(--rule)" }}>
              <div className="k">Temperature</div>
              <div className="v">{live.conditions.tempF !== null ? Math.round(live.conditions.tempF) : "—"}°</div>
              <div className="s">fahrenheit</div>
            </div>
          </div>
          <p className="note">
            Visibility is a modelled value, not a dust sensor — there is no public air-quality station near Gerlach.
            Treat it as a hint, and believe the cameras and the Gate over it.
          </p>
        </section>
      )}

      {/* ----------------------------------------------------- 08 cameras */}
      {live?.cameras && live.cameras.length > 0 && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">03</span><h2>Cameras</h2></div>
            <span className="chip chip--dash">refreshes 90s</span>
          </div>
          {live.cameras.map((c) => {
            const stale = c.ageSec !== null && c.ageSec > 20 * 60;
            return (
              <figure className="cam" key={c.id}>
                <div className="fr">
                  <img
                    src={`/api/cam/${c.id}?t=${camKey}`}
                    alt={c.label}
                    loading="lazy"
                    className={stale ? "stale" : undefined}
                    onError={(e) => { (e.currentTarget.closest("figure") as HTMLElement).style.display = "none"; }}
                  />
                  {c.ageSec !== null && (
                    <span className={`age${stale ? " stale" : ""}`}>
                      {stale ? `⚠ frame ${fmtMins(c.ageSec / 60)} old` : `live · ${fmtMins(c.ageSec / 60)} old`}
                    </span>
                  )}
                </div>
                <figcaption><b>{c.label}</b> — {c.where}</figcaption>
              </figure>
            );
          })}
          <p className="note">
            Age comes from the camera host&rsquo;s own <code>Last-Modified</code>. A frame older than 20 minutes is
            dimmed and flagged — Bruno&rsquo;s serves hours-old frames with a broken on-image clock, so ignore the
            timestamp burned into the picture.
          </p>
        </section>
      )}

      {/* ---------------------------------------------------- 09 forecast */}
      {live?.forecasts && live.forecasts.length > 0 ? (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">04</span><h2>Forecast</h2></div>
            <span className="chip chip--dash">NWS Reno</span>
          </div>
          <div className="wx">
            {live.forecasts.map((f) => (
              <div className="d" key={f.date} style={{ borderTopColor: Number(f.gust) >= 25 ? "var(--r3)" : "var(--rule)" }}>
                <div className="dd">{pt(`${f.date}T18:00:00Z`, { weekday: "short", month: "numeric", day: "numeric" })}</div>
                <div className="t">{f.high}°<small> / {f.low}°</small></div>
                {f.gust && <div className="g">gusts {f.gust} mph {f.windDirection ?? ""}</div>}
                <p>{f.message}</p>
              </div>
            ))}
          </div>
        </section>
      ) : live?.weatherText && live.weatherText.length > 0 ? (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">04</span><h2>Forecast</h2></div>
            <span className="chip chip--dash">as posted by BRC</span>
          </div>
          <div className="stream">
            {live.weatherText.map((w, i) => (
              <div className="it" key={i}><p style={{ whiteSpace: "pre-line" }}>{w}</p></div>
            ))}
          </div>
        </section>
      ) : null}

        </>
      )}

      {tab === "feed" && (
        <>
      {/* --------------------------------------------- 10 official traffic */}
      {live?.traffic && live.traffic.length > 0 && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">01</span><h2>@bmantraffic</h2></div>
            <span className="chip"><i style={{ background: "var(--r1)" }} />official</span>
          </div>
          <div className="stream">
            {live.traffic.slice(0, 12).map((t) => (
              <div className="it" key={t.id}>
                <p>{t.text}</p>
                <div className="meta">
                  <span>{pt(t.createdAt, { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                  {t.minutes !== null && (
                    <span style={{ color: waitColor(t.minutes), fontWeight: 700 }}>{fmtMins(t.minutes)}</span>
                  )}
                  <span>{ago(t.createdAt, now)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- 11 chatter */}
      {live?.social && live.social.length > 0 && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">02</span><h2>Chatter</h2></div>
          </div>
          <p className="lede" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>
            None of this is verified. Read it as rumour, not data.
          </p>
          <div className="stream">
            {live.social.slice(0, 12).map((p) => (
              <div className="it" key={p.id}>
                <p><a href={p.url} target="_blank" rel="noreferrer">{p.title}</a></p>
                <div className="meta">
                  <span>{p.network} · {p.author} · {ago(p.createdAt, now)}</span>
                  <span className="tag-un">unverified</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- 12 BMIR */}
      {live?.bmir && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">03</span><h2>BMIR 94.5</h2></div>
            <span className="chip chip--dash">{live.bmir.enabled ? "on air" : "off"}</span>
          </div>
          <div className="stats">
            <div className="statc" style={{ borderTopColor: "var(--ink)" }}>
              <div className="k">On air now</div>
              <div className="v" style={{ fontSize: 30 }}>{live.bmir.onAir?.dj ?? "—"}</div>
              {live.bmir.onAir && <div className="s">till {pt(live.bmir.onAir.end, { hour: "numeric", minute: "2-digit" })}</div>}
            </div>
            <div className="statc" style={{ borderTopColor: "var(--rule)" }}>
              <div className="k">Up next</div>
              <div className="v" style={{ fontSize: 30 }}>{live.bmir.next?.dj ?? "—"}</div>
              {live.bmir.next && <div className="s">{pt(live.bmir.next.start, { hour: "numeric", minute: "2-digit" })}</div>}
            </div>
          </div>
          <p className="note">
            <a href={live.bmir.streamUrl} target="_blank" rel="noreferrer">Open the stream ↗</a> — 94.5 FM once you
            are close enough, and GARS 95.1 carries traffic information on the approach.
          </p>
        </section>
      )}

      {/* ----------------------------------------------------- 13 webcast */}
      {live?.webcast && (
        <section className="sec">
          <div className="sec-hd">
            <div className="l"><span className="sec-num">04</span><h2>Webcast</h2></div>
            <span className="chip chip--dash">{live.webcast.available ? "live" : "off air"}</span>
          </div>
          {live.webcast.available && live.webcast.playbackId ? (
            <div style={{ position: "relative", paddingTop: "56.25%", border: "2px solid var(--ink)" }}>
              <iframe
                src={`https://lvpr.tv/?v=${live.webcast.playbackId}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                title="Black Rock City webcast"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          ) : (
            <p className="lede">
              Off air. Burning Man streams from the playa during the burns; this player appears on its own when they
              go live.
            </p>
          )}
        </section>
      )}

        </>
      )}

      {tab === "info" && (
        <>
      {/* ----------------------------------------------------- 14 sources */}
      <section className="sec">
        <div className="sec-hd">
          <div className="l"><span className="sec-num">01</span><h2>Sources</h2></div>
        </div>
        <div className="chips" style={{ marginTop: 0 }}>
          {Object.entries(live?.sourceHealth ?? {}).map(([k, v]) => (
            <span className="chip" key={k}>
              <i style={{ background: v === "ok" ? "var(--r1)" : v === "empty" ? "var(--r3)" : "var(--r5)" }} />
              {k.replace(/_/g, " ")} · {v}
            </span>
          ))}
          {!live && <span className="chip chip--dash">waiting for first response</span>}
        </div>
        <p className="note">
          &ldquo;Empty&rdquo; means the source answered but had nothing to say; &ldquo;error&rdquo; means it refused
          or timed out. Nothing here is synthesised — if a source is down, its section disappears rather than
          showing a guess.
        </p>
      </section>

      <footer className="foot">
        <div>Reads the same public feeds as brcdashboard.burningman.org and keeps the history they throw away.</div>
        <div>
          Travel times are Gravel Pit → Gate. They exclude the drive from Reno (~2h 15m to Gerlach) and the crawl
          through Greeters.
        </div>
        <div>
          All times Pacific · refreshes every 60s · last good response cached for when you lose signal
          {live?.archiveCount ? ` · ${live.archiveCount} readings archived` : ""}
          {live?.manBurnAt ? ` · the Man burns ${pt(live.manBurnAt, { weekday: "long", hour: "numeric", minute: "2-digit" })} PT` : ""}
          {live?.flags?.trafficWindowHours ? ` · upstream publishes a ${live.flags.trafficWindowHours}h rolling window` : ""}
        </div>
        <div>Unofficial · not affiliated with Burning Man Project</div>
      </footer>
        </>
      )}
    </div>
  );
}

const DUST_COLOR: Record<string, string> = {
  calm: "var(--r1)", dusty: "var(--r3)", whiteout: "var(--r5)", unknown: "var(--rule)",
};

/** Where today sits relative to gate open, in the same labels the history uses. */
function histDayLabel(now: number): string {
  const off = Math.floor((now - GATE_OPEN) / 86_400_000 + 1) - 1;
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: PT, weekday: "short" }).format(new Date(now));
  return off === 0 ? "SUN open" : `${wd} ${off >= 0 ? "+" : ""}${off}`;
}
