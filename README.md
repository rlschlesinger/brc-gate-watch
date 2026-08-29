# Gate Watch · Black Rock City 2026

Live Gravel-Pit-to-Gate travel times for Burning Man 2026, plus the history the
official dashboard throws away.

Live at **https://brc-gate-watch.vercel.app**

## Why it exists

`brcdashboard.burningman.org` publishes the real numbers, but only as rolling
windows: six hours of half-hourly gate-crossing times and about twelve hours of
`@bmantraffic` posts. Everything older is discarded. This app polls those
windows and keeps them, so you can see the shape of the whole arrival period
rather than the last few hours of it.

## Data sources

| Source | What it gives | Notes |
| --- | --- | --- |
| `brcdashboard.burningman.org/api/feed/public` | crossing-time table, `@bmantraffic` posts, forecasts, operator banners | undocumented but public; no CORS, so it is proxied server-side |
| `…/api/gate-status` | inbound/outbound lane status | dormant until the Gate turns it on |
| `api.weather.gov` | Gerlach forecast + active alerts | grid `REV/76,159` |
| `api.open-meteo.com` | wind gusts, modelled visibility | the closest free dust proxy; no real sensor exists near Gerlach |
| `webcam.burningman.org`, `nvroads.com/map/cctv/7105` | roadside cameras | proxied; frame age is read from `Last-Modified` and flagged when stale |
| Reddit RSS, Bluesky, Mastodon | unverified road chatter | rate-limited and flaky by design; the page degrades rather than faking it |

Deliberately **not** used: the Twitter/X syndication endpoint. It still returns
data, but the newest post is from 2025 — polling it would render three-year-old
mudpocalypse closure notices as today's status.

## Architecture

- `app/api/live` — fans out to every source, merges, folds new readings into the archive
- `app/api/history` — the accumulated archive
- `app/api/cam/[id]` — camera proxy
- `lib/parse.ts` — travel-time text parsing and Pacific-time anchoring for the crossing table
- Archive lives in Vercel Blob; `.github/workflows/heartbeat.yml` pings `/api/live` every
  10 minutes so it keeps filling when nobody has the page open

## Local

```
npm install
npm run dev     # http://localhost:3077
```
