# Feature inventory / regression checklist

Every capability the app ships, and how to prove it still works. **The design
pass must not remove anything on this list.** Several of these render as an
explanatory placeholder today and only light up during the event — deleting them
because they look empty on a Saturday afternoon is the exact failure this file
exists to prevent.

Verify the data side with `curl -s https://brc-gate-watch.vercel.app/api/live | jq`.

## Live data (11 sources, each independently degradable)

| # | Feature | Payload field | Renders as | State when quiet |
|---|---|---|---|---|
| 1 | Current Gravel→Gate time | `current` | hero numeral + trend + verdict word | "—:—" and a "connecting" chip |
| 2 | Recorded wait chart, 6/12/24/72h | `toc` + archive | SVG line chart, touch scrub | "not enough points yet" |
| 3 | Half-hourly crossing table | `toc` (source `toc`) | folded into the chart | — |
| 4 | @bmantraffic hourly posts | `traffic` | feed with parsed minutes | card hidden if empty |
| 5 | **Gate lane status** | `gate`, `flags.gateVisible` | inbound/outbound/status | **placeholder card explaining the Gate has it switched off** |
| 6 | Operator banner messages | `banners` | coloured alerts | none shown |
| 7 | **Placeholder-mode warning** | `flags.placeholderMode` | red alert over everything | hidden (correct) |
| 8 | NWS forecast, 4 day | `forecasts` | scrollable day cards | falls back to `weatherText` |
| 9 | **BRC-posted weather text** | `weatherText` | fallback list | only when `forecasts` is empty |
| 10 | NWS active alerts | `nws.alerts` | red/amber alerts | none shown |
| 11 | Wind, gusts, visibility, dust risk | `conditions` | two stat tiles | card hidden |
| 12 | Route cameras + frame age | `cameras` | proxied images, stale flagged | broken camera hides itself |
| 13 | **BRC webcast** | `webcast` | lvpr.tv iframe when live | "off air" note |
| 14 | **BMIR 94.5 now/next + stream** | `bmir` | on-air DJ, next DJ, stream link | "—" |
| 15 | **Man burn time** | `manBurnAt` | footer line | omitted |
| 16 | Road chatter | `social` | Reddit + Bluesky + Mastodon | card hidden |
| 17 | Source status chips | `sourceHealth` | ok / empty / error per source | always visible |
| 18 | Upstream window size | `flags.trafficWindowHours` | footer line | omitted |

## Derived / historical

| # | Feature | Where | Notes |
|---|---|---|---|
| 19 | Persistent wait archive | `/api/history`, Vercel Blob | grows on every `/api/live` call |
| 20 | Rolling-window backfill | `mergeIntoArchive` | one call recovers the whole 6–12h window |
| 21 | GitHub Actions heartbeat | `.github/workflows/heartbeat.yml` | every 10 min |
| 22 | Day × hour heatmap, **per year** | `Historical.tsx` | 2018/2019/2022/2024/2025 must stay separate, never pooled |
| 23 | Arrival / exodus toggle | `Historical.tsx` | a phase with too few readings is dropped and its toggle dimmed |
| 24 | Wait by day, median + peak | `DayBars` | |
| 25 | Sourced pattern statements | `historical.insights` | each links its source |
| 26 | "When to roll in" ranking | `WhenToLeave.tsx` | ranks by the **worst** of `rankingYears` only (years with ≥60 readings); flags partial coverage |
| 27 | Leave-Reno back-calculation | `WhenToLeave.tsx` | 135 min to the gravel |
| 28 | Verdict sentence | `buildVerdict` | plain-language read of the current number |
| 29 | 24h median / best / worst | `stats` | |
| 30 | Gate-open countdown | `countdown` | |

## Resilience and honesty affordances — do not remove

| # | Feature | Why it matters |
|---|---|---|
| 31 | Last-good response cached to `localStorage` | he will lose signal on the 447 |
| 32 | Staleness dot: live / stale / offline | a frozen number must not look current |
| 33 | "This reading is Nh old" in the verdict | |
| 34 | Per-source health chips with ok/empty/error | a dead source must be visible, not silently absent |
| 35 | Camera frame age + dimming past 20 min | Bruno's serves hours-old night frames with a broken clock |
| 36 | "unverified" tag on social chatter | strangers, not the Gate |
| 37 | Separate-years framing on historical | pooling 2024+2025 describes a year that never happened |
| 38 | Partial-coverage warning in rankings | |
| 38b | Thin years excluded from ranking, kept in the record | 2019 arrival was one reading rendering as "0m" |
| 39 | "modelled, not a dust sensor" note | there is no air-quality station near Gerlach |
| 40 | Empty sources hide their card rather than showing zeros | |

## Design system (Claude Design import, `Gate Watch.dc.html`)

| # | Feature | Notes |
|---|---|---|
| 51 | Paper/ink palette, light **and** dark | `--paper`/`--ink`/`--rule` + 5-step ramp `--r1..--r5` |
| 52 | AUTO / DAY / NIGHT toggle | persists to `localStorage`, applied pre-paint so a night driver is never flashed white |
| 53 | Dust grain overlay | CSS only, `multiply` on paper, `screen` on night, 30%/22% |
| 54 | Monumental hero numeral | `clamp(96px,38vw,272px)`, H:MM, tabular |
| 55 | One-word verdict + ramp swatch | moving / normal / slow / heavy / brutal |
| 56 | Numbered stencil section headers | `01`–`14`, 2px ink rule |
| 57 | Bar chart for the live window | replaces the line chart; buckets to ≤~24 bars, NOW outlined |
| 58 | **GRID / CLOCK** heatmap toggle | clock = BRC's own geometry, hours around the dial, days as rings, live needle |
| 59 | Ramp legend | thresholds 45m / 90m / 2.5h / 4h |
| 60 | Segmented controls, 40px min height | hard-edged, inverted when active |
| 61 | **Five-panel navigation** | NOW / PLAN / ROAD / FEED / INFO — fixed thumb-reachable bar on mobile, masthead row ≥760px |
| 62 | Compact wait strip on non-NOW panels | the number stays visible wherever you are |
| 63 | Deep-linkable panels | `#plan`, `#road`, … survive reload and sharing |
| 64 | Alert pips on tabs | NOW flags active alerts, ROAD flags a stale camera |
| 65 | Critical notices are global | placeholder mode, stale reading and NWS alerts show on every panel |
| 66 | **MEDIAN / AVG / MIN / MAX selector** | drives the ranking, the heatmap and the day bars together; the copy under each restates which one is showing |
| 67 | Day bars always keep the worst | the faint bar behind stays `max` whatever is selected, so switching cannot hide a bad day |
| 68 | Per-year figures on every ranked row | a calm median hiding one brutal year stays visible |
| 68b | **Playa glyphs on the tabs** | game-icons.net hand-drawn silhouettes, CC BY 3.0, same set as The Guide; `currentColor` so they take the tab ink |
| 68c | Icon attribution | `ATTRIBUTION.md` + a credit line in the INFO footer — the licence requires it |
| 69 | Live social card | `/opengraph-image` renders the real current wait, sparkline and 24h median/min/max, in Barlow Condensed |
| 70 | Equal-height bar labels | unlabelled columns reserve the same space, or the row camels |

Colour is load-bearing here: the ramp is the only saturated thing on the page,
so it must keep meaning wait time and nothing else.

## Platform

| # | Feature | Check |
|---|---|---|
| 41 | Auto-refresh 60s, pause-aware | `visibilitychange` + `online` listeners |
| 42 | Camera refresh 90s | separate cache-bust key |
| 43 | Mobile-first, 390px, 56px tab targets | **verified** at 390px: chart draws in real pixels, heatmap uses `minmax(0,1fr)` inside a scroll container |
| 44 | `prefers-reduced-motion` honoured | `globals.css` |
| 45 | OG / Twitter card | `/opengraph-image` renders live data, 5-min revalidate, falls back to a neutral card if the feed is down |
| 46 | Favicon | `/icon.svg` |
| 47 | PWA manifest, add-to-home-screen | `/manifest.webmanifest` |
| 48 | Publicly reachable, no deploy protection | `curl -o /dev/null -w '%{http_code}'` → 200 |
| 49 | Safe-area insets for notched phones | `--safe-b` in `globals.css` |
| 50 | Camera proxy, no direct third-party image loads | `/api/cam/[id]` |

## Deliberately excluded — do not "fix" these

- **X/Twitter syndication endpoint.** Still returns 100 parseable tweets, but the
  newest is from August 2025 and the set is dominated by 2023 mudpocalypse "Do
  not travel to Black Rock City!" notices. Polling it would render three-year-old
  emergency closures as today's status.
- **NVRoads `RoadConditions` for SR-447.** Has a `lastUpdated` field, so it looks
  live; the content reads "No Report" and was last touched 2 March 2024.
- **Reddit JSON API.** 403s from cloud IPs at every path. Only the RSS feed
  works, and it burns its whole rate-limit budget in one request — hence exactly
  one call per poll.
- **Pooled multi-year averages.** See #37.


## Carried in the API but not displayed

- `serverTime` — the upstream feed's own clock. Kept in `/api/live` for
  diagnostics; staleness on the page is measured from `fetchedAt` instead.
