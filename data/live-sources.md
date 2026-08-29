# BRC Gate Wait — Live Data Source Reconnaissance

**Probed:** 2026-08-29, ~14:52–15:05 UTC (07:52–08:05 PT), from a residential US IP.
**Event context:** Gate opens 12:01am Sun Aug 30, 2026. Early arrival / work-access traffic is
already flowing, so several "pre-event" feeds are in fact already live.

> **Ground rule applied throughout:** every claim below was tested with a real request.
> Where something does not work, it is marked DEAD and the reason is given. Do not wire a
> "live" widget to anything in the DEAD section.

---

## Summary table

| # | Source | URL | Auth | CORS | Live now? | Poll | Verdict |
|---|--------|-----|------|------|-----------|------|---------|
| 1 | **BRC Dashboard aggregate feed** | `brcdashboard.burningman.org/api/feed/public` | No | **No** → proxy | **YES — live gate travel times** | 30–60s | **Primary. Build on this.** |
| 2 | **BRC Dashboard gate status** | `…/api/gate-status` | No | No → proxy | Live endpoint, `null` values (pre-open) | 30s | **Primary once populated** |
| 3 | BRC Dashboard SSR data | `…/__data.json` | No | No → proxy | Yes (Man-burn countdown, alert) | 5 min | Useful secondary |
| 4 | BRC webcast status | `…/api/webcast-status` | No | No → proxy | Yes (`available:false`) | 60s | Good boolean |
| 5 | **NWS / api.weather.gov** | `api.weather.gov/gridpoints/REV/76,159/forecast` | No | **Yes `*`** | Yes | 10–30 min | **Excellent, browser-direct** |
| 6 | **NWS active alerts** | `api.weather.gov/alerts/active?point=40.7864,-119.2065` | No | **Yes `*`** | Yes (empty = no alerts) | 5 min | **Excellent** |
| 7 | **Open-Meteo** | `api.open-meteo.com/v1/forecast?…` | No | **Yes `*`** | Yes | 10–15 min | **Excellent — gusts + visibility** |
| 8 | **Bluesky searchPosts** | `api.bsky.app/xrpc/app.bsky.feed.searchPosts` | No | **Yes `*`** | Yes | 2–5 min | **Good chatter source** |
| 9 | **Gerlach webcam** | `webcam.burningman.org/` | No | No (but `<img>` OK) | Image serves; **~6.5h stale today** | 60s | Good *if* you check `Last-Modified` |
| 10 | NVRoads camera stills | `nvroads.com/map/cctv/{id}` | No | No (but `<img>` OK) | Yes | 60s | Useful — but nothing on 447 |
| 11 | NVRoads layer data | `nvroads.com/List/GetData/{layer}` | No | No → proxy | Yes | 5 min | Mixed; see caveats |
| 12 | Mastodon public timeline | `mastodon.social/api/v1/timelines/tag/burningman` | No | **Yes `*`** | Yes | 5 min | Low volume, works |
| 13 | OSRM routing | `router.project-osrm.org/route/v1/driving/…` | No | **Yes `*`** | Yes | 1 hr | Baseline only — **no traffic** |
| 14 | ADS-B (adsb.lol / adsb.fi) | `api.adsb.lol/v2/lat/…/lon/…/dist/25` | No | No → proxy | Yes | 60s | Fun BRC-airport signal |
| 15 | journal.burningman.org WP REST | `journal.burningman.org/wp-json/wp/v2/posts` | No | Yes | Yes | 1 hr | Editorial only, not ops |
| — | **Reddit JSON / RSS** | — | — | — | — | — | **DEAD — see below** |
| — | **X / Twitter (any free route)** | — | — | — | — | — | **DEAD — see below** |
| — | PurpleAir / OpenAQ / Google / TomTom / Mapbox / HERE | — | **Key** | — | — | — | Keyed only |

---

# TIER 1 — The primary target, fully reverse-engineered

## How `brcdashboard.burningman.org` actually works

It is a **SvelteKit 2 / Svelte 5 SPA** behind Cloudflare, origin on AWS (an ALB — note the
`AWSALB` cookies). `curl` of `/` returns only the shell; all data arrives client-side.

The build is at `/_app/immutable/`. Walking the module graph:

- `_app/immutable/entry/app.*.js` holds the SvelteKit route manifest. Routes are:
  `/`, `/bmir`, `/kiosk`, `/toc`, `/weather`, plus server-gated `/admin/*`, `/audit`, `/login`, `/logout`.
- The `/` route node (`_app/immutable/nodes/2.*.js`) is the whole story — decompiled:

```js
import { s as setFeed, F as FeedPoller } from "../chunks/C__LZOco.js";
function root(anchor, props) {
  const poller = new FeedPoller("public");   // <-- channel name
  setFeed(poller);
  onMount(() => poller.start());
  onDestroy(() => poller.stop());
  PublicDashboard(anchor, {});
}
```

- The poller class itself (chunk `Bp3-9w_4.js`), decompiled:

```js
const MAX_BACKOFF = 15e3;
class FeedPoller {
  constructor(channel, intervalMs = 3e3, transform) { … }   // default 3000 ms
  start() { this.poll(); this.timer = setInterval(() => this.poll(), this.currentInterval); … }
  async poll() {
    const headers = this.etag ? { "If-None-Match": this.etag } : {};
    const r = await fetch(`/api/feed/${this.channel}`, { headers, credentials: "include" });
    if (r.status === 304) { … return; }          // ETag revalidation
    this.etag = r.headers.get("ETag");
    this.current = await r.json();
  }
  onError() { this.currentInterval = Math.min(this.currentInterval * 2, MAX_BACKOFF); }  // 3s→6s→12s→15s
}
```

**So the entire public dashboard is one endpoint polled every 3 seconds with ETag revalidation.**

### Endpoint inventory found in the bundles

| Path | Method | Public? | Notes |
|---|---|---|---|
| `/api/feed/public` | GET | **Yes** | The aggregate feed. Everything. |
| `/api/feed/bmir` | GET | 403 | Auth-gated channel |
| `/api/feed/toc` | GET | 403 | Auth-gated channel |
| `/api/gate-status` | GET | **Yes** | Inbound/outbound wait |
| `/api/webcast-status` | GET | **Yes** | Livepeer availability |
| `/api/weather` | GET | 403 | Forbidden |
| `/api/audit` | GET | 403 | Forbidden |
| `/api/man-burn`, `/api/*-visibility`, `/api/placeholder-mode` | **PATCH only** | writes | `Allow: PATCH`, admin |
| `/api/bmir-default-dj` | **PUT only** | writes | admin |
| `/api/messages` | **POST only** | writes | admin |
| `/api/admin/*` (channels, config, logs, messages, sync, tweets, users, google, simulated-time) | — | auth | Admin console |
| `/__data.json` | GET | **Yes** | SvelteKit SSR payload |

`robots.txt`, `manifest.json`, `sitemap.xml` → all 404. There is no `/api/status`, `/data.json`,
or `/_next/data/*` (it is SvelteKit, not Next). **No websocket, no Firebase, no Airtable, no
Google Sheets ID, no S3/CloudFront JSON** appears anywhere in the bundles. The only third-party
hosts referenced are Google Tag Manager (`GTM-KLZPCP2`), Google Fonts, `lvpr.tv` (Livepeer
player), `stream.daz.radio` (BMIR audio) and `x.com/bmantraffic`.

---

## 1. `/api/feed/public` — THE endpoint ⭐

```
GET https://brcdashboard.burningman.org/api/feed/public
```

**Auth:** none. **Method:** GET. **Headers required:** none (send `If-None-Match` to get 304s).

Response headers:
```
HTTP/2 200
content-type: application/json
cache-control: public, s-maxage=3
etag: W/"6cbda82cb7b5c4dae963bdcb9fe23937a2465751"
cf-cache-status: DYNAMIC
```

**CORS: NO `Access-Control-Allow-Origin` header at all.** An `OPTIONS` preflight returns **403**.
→ **Browser fetch is impossible. You must proxy it server-side** (Vercel route handler / edge function).

**Live status: FULLY LIVE RIGHT NOW.** ~17.8 KB. Real response (trimmed to 2 items per array):

```json
{
  "version": "W/\"6cbda82cb7b5c4dae963bdcb9fe23937a2465751\"",
  "serverTime": 1788015305010,
  "feeds": {
    "@bmantraffic": true,
    "BMIR Stream": true,
    "Weather": true,
    "Webcast": false
  },
  "channelsEnabled": {
    "public_banner": true
  },
  "messages": [
    {
      "id": "YdRtMR7onTx5YZ31R2Dy6",
      "subject": "{\"color\":\"blue\",\"title\":\"Travel safe and see you soon!\"}",
      "content": "As you travel to BRC, take your time, drive safely, obey all traffic laws, and keep an eye on the BRC Dashboard for travel times and weather condition updates.",
      "priority": 0,
      "created_at": "2026-08-29T01:54:29.662Z",
      "last_updated": null,
      "pinned": false,
      "expires_at": null,
      "severity": "standard",
      "source_dept": null,
      "channels": [
        {
          "id": "public_banner",
          "name": "public banner"
        }
      ]
    }
  ],
  "synced": {
    "traffic": [
      {
        "id": "2093713550128873614",
        "text": "The current travel time from Gravel to Gate is 20 minutes. \ud83c\udfce\ufe0f",
        "note_tweet": null,
        "created_at": "2026-08-29T14:53:04.000Z",
        "author": {
          "name": "Burning Man Traffic",
          "username": "bmantraffic"
        }
      },
      {
        "id": "2093698477134061728",
        "text": "The current travel time from Gravel to Gate is 40 minutes. \ud83d\ude97",
        "note_tweet": null,
        "created_at": "2026-08-29T13:53:10.000Z",
        "author": {
          "name": "Burning Man Traffic",
          "username": "bmantraffic"
        }
      }
    ],
    "traffic_window_hours": 12,
    "toc": [
      [
        "7:30 AM",
        "0 h, 40 m",
        ""
      ],
      [
        "7:00 AM",
        "0 h, 40 m",
        ""
      ],
      [
        "6:30 AM",
        "0 h, 40 m",
        ""
      ]
    ],
    "weather_forecasts": [
      {
        "date": "2026-08-29",
        "high": "87",
        "low": "54",
        "message": "Sunny, with a high near 87. Southwest wind 0 to 20 mph. Possible gusts to 30 mph.",
        "icon": "windy",
        "windDirection": "SW",
        "gust": "30",
        "dayIcon": "windy",
        "dayMessage": "Sunny, with a high near 87. Southwest wind 0 to 20 mph. Possible gusts to 30 mph.",
        "dayGust": "30",
        "dayWindDirection": "SW",
        "nightIcon": "cloudy",
        "nightMessage": "Mostly clear, with a low around 54. West wind 0 to 20 mph. Possible gusts to 25 mph.",
        "nightGust": "25",
        "nightWindDirection": "W"
      }
    ],
    "dj_schedule": [
      {
        "label": "Thu 8/27",
        "date": "2026-08-27",
        "start": 1787814000000,
        "sets": [
          {
            "dj": "Organism",
            "start": 1787857200000,
            "end": 1787864400000
          },
          {
            "dj": "4Day",
            "start": 1787864400000,
            "end": 1787871600000
          }
        ]
      }
    ],
    "gate_status_visibility": false,
    "traffic_visibility": true,
    "route_diagram_visibility": true,
    "placeholder_mode": false
  },
  "weatherUpdatedAt": 1788008736304
}
```

### The fields that matter for a gate-wait dashboard

**`synced.traffic`** — the mirrored @bmantraffic timeline, roughly hourly, `traffic_window_hours: 12`.
This is the *actual* gate-wait number. All 13 entries as of the probe:

```
2026-08-29T14:53:04Z | The current travel time from Gravel to Gate is 20 minutes. 🏎️
2026-08-29T13:53:10Z | The current travel time from Gravel to Gate is 40 minutes. 🚗
2026-08-29T12:59:27Z | The current travel time from Gravel to Gate is 40 minutes.
2026-08-29T11:57:54Z | The current travel time from Gravel to Gate is 20 minutes.
2026-08-29T11:02:45Z | The current travel time from Gravel to Gate is 45 minutes.
2026-08-29T10:01:15Z | The current travel time from Gravel to Gate is 2 hours 🏎️
2026-08-29T08:58:17Z | The current travel time from Gravel to Gate is 2 hours. 🛺
2026-08-29T08:02:35Z | The current travel time from Gravel to Gate is 3 hours. 🚚
2026-08-29T07:04:31Z | The current travel time from Gravel to Gate is 2 hours
2026-08-29T05:57:26Z | The current travel time from Gravel to Gate is 2 hours, 30 minutes. 🚗
2026-08-29T04:58:10Z | The current travel time from Gravel to Gate is 3 hours.🚗
2026-08-29T04:04:17Z | The current travel time from Gravel to Gate is 2 hours, 30 minutes.
2026-08-29T02:59:19Z | The current travel time from Gravel to Gate is 2 hours.🚗
```

⚠️ **The wait time is free text with emoji.** You must parse it. The observed grammar is
`N minutes` | `N hours` | `N hours, M minutes` | `N hours M minutes`, with an optional trailing
emoji and inconsistent punctuation (note `3 hours.🚗` with no space). Write a tolerant regex and
**fall back to showing the raw sentence** rather than a wrong number. Also note BM has historically
posted non-travel-time messages on this account (closures, "do not travel"), so always handle the
no-match case.

**`synced.toc`** — the Time-Off-Chart: 30-minute buckets of historical wait, newest first.
`[time_label, duration, note]`:

```json
[["7:30 AM","0 h, 40 m",""],["7:00 AM","0 h, 40 m",""],["6:30 AM","0 h, 40 m",""],
 ["6:00 AM","0 h, 40 m",""],["5:30 AM","0 h, 20 m",""],["5:00 AM","0 h, 20 m",""],
 ["4:30 AM","0 h, 45 m",""],["4:00 AM","0 h, 45 m",""],["3:30 AM","2 h, 0 m",""],
 ["3:00 AM","2 h, 0 m",""],["2:30 AM","2 h, 0 m",""],["2:00 AM","2 h, 0 m",""]]
```
This is your sparkline/history chart, already bucketed. Times are PT, no date — infer the day.

**`synced.weather_forecasts`** — 4 days, pre-parsed with day/night split, gust and wind direction
already extracted. Strictly better than parsing NWS text yourself for display purposes.

**`synced.gate_status_visibility` / `traffic_visibility` / `route_diagram_visibility` / `placeholder_mode`**
— BM's own operator kill-switches. `gate_status_visibility` is currently `false`, which is exactly
why `/api/gate-status` returns nulls. **Mirror these flags:** if BM hides a panel, you should too,
otherwise you will be displaying data they have deliberately pulled.

**`feeds`** — per-source health: `{"@bmantraffic": true, "BMIR Stream": true, "Weather": true, "Webcast": false}`.
Use this to drive your own "source unavailable" states.

**`messages`** — operator banner. `subject` is a **JSON string inside a string** —
`"{\"color\":\"blue\",\"title\":\"Travel safe and see you soon!\"}"` — double-parse it.

**`synced.dj_schedule`** — BMIR DJ lineup with epoch-ms `start`/`end` per set. This is the
"now playing" source; there is no BMIR now-playing API (see §DEAD).

**Recommended poll: 30–60s server-side, cached.** The origin sets `s-maxage=3` and the site itself
polls at 3s, but the underlying data changes about once an hour. Polling at 3s from a server would
be abusive and pointless. Send `If-None-Match` and honour 304s.

---

## 2. `/api/gate-status` — the purpose-built one ⭐

```
GET https://brcdashboard.burningman.org/api/gate-status
```
**Auth:** none. **CORS:** none → proxy. **Headers:** `cache-control: public, max-age=10`.

**Exact current response:**
```json
{"inbound":null,"outbound":null,"status":null}
```

**Dormant, not broken.** The endpoint is deployed and returns 200 with a stable three-key shape;
the values are null because `gate_status_visibility` is `false` in the feed. Expect `inbound` and
`outbound` to populate at/after gate open. `/__data.json` confirms the same shape server-side
(`"gateStatus": {"inbound": null, "outbound": null}`).

**Design implication:** build the gate-status panel to render "not yet reporting" from `null` and
light up automatically. Until then, `synced.traffic` is your real number. Poll 30s.

---

## 3. `/__data.json` — SSR layout payload

```
GET https://brcdashboard.burningman.org/__data.json
```
No auth, no CORS (proxy), `cache-control: private, no-store`. SvelteKit's deduplicated format
(integers are indices into the same array — you must resolve them):

```json
{"type":"data","nodes":[{"type":"data","data":[
 {"user":1,"weatherAlert":2,"gateStatus":6,"gateStatusVisible":3,"placeholderMode":3,
  "manBurn":7,"manBurnVisible":12,"simulatedNow":1,"canAudit":3},
 null,
 {"active":3,"text":4,"severity":5,"icon":4},
 false,"","advisory",
 {"inbound":1,"outbound":1},
 {"state":8,"burnsAt":9,"burningText":10,"ashesText":11},
 "countdown","2026-09-05T21:00:00-07:00","The Man Burns","The Man is dead. Long live The Man",
 true],"uses":{}},null]}
```

Resolved: the Man burns **2026-09-05T21:00:00-07:00**, `weatherAlert.active = false`,
`gateStatusVisible = false`, `placeholderMode = false`. Useful for the burn countdown and as a
cross-check on the visibility flags. Poll 5 min. Note `simulatedNow` — the admin console can
time-shift the whole dashboard, so do not treat its timestamps as absolute truth.

## 4. `/api/webcast-status`

```json
{"available":false,"playbackId":"890as2fty0cqqajf"}
```
`cache-control: public, s-maxage=15, stale-while-revalidate=30`. No auth, no CORS.
The dashboard polls this every 60s and, when `available`, embeds `https://lvpr.tv/?v={playbackId}`.
I confirmed the Livepeer stream is genuinely not up yet
(`playback.livepeer.studio/asset/hls/890as2fty0cqqajf/index.m3u8` → `No playback URL found`).
Poll 60s. This is a clean, honest boolean for a "live webcast" tile.

---

# TIER 2 — Independent corroborating sources

## 5–6. NWS `api.weather.gov` ⭐ (browser-direct)

Grid resolution for the playa (40.7864, -119.2065) → **office `REV`, grid `76,159`**.

| Purpose | URL |
|---|---|
| Forecast | `https://api.weather.gov/gridpoints/REV/76,159/forecast` |
| Hourly | `https://api.weather.gov/gridpoints/REV/76,159/forecast/hourly` |
| Raw grid | `https://api.weather.gov/gridpoints/REV/76,159` |
| **Alerts** | `https://api.weather.gov/alerts/active?point=40.7864,-119.2065` |
| Stations | `https://api.weather.gov/gridpoints/REV/76,159/stations` |

**Auth:** none, but **send a descriptive `User-Agent` with a contact** — NWS policy, and generic
UAs get throttled. **CORS: `access-control-allow-origin: *`** — safe to call straight from the browser.

Alerts, verified live:
```json
{"@context":{"@version":"1.1"},"type":"FeatureCollection","features":[],
 "title":"Current watches, warnings, and advisories for 40.7864 N, 119.2065 W",
 "updated":"2026-08-29T14:54:49+00:00"}
```
`features: []` = no active alerts. **Do not render "no data" for an empty array — that is a real
"all clear".** This is the endpoint that will carry Dust Storm Warnings and High Wind Advisories.

Nearest observation stations are all remote RAWS-style sites (`BLUN2` Bluewing Mountain,
`FOXN2` Fox Mountain, `BUFN2` Buffalo Creek, `MJBN2` Majuba). The nearest *reliable* METAR is
`KLOL` (Lovelock, ~60 mi E) — verified returning current obs but too far to represent playa dust.
Poll: forecast 30 min, alerts 5 min.

## 7. Open-Meteo ⭐ (browser-direct, best wind/dust proxy)

```
https://api.open-meteo.com/v1/forecast?latitude=40.7864&longitude=-119.2065
  &current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility
  &hourly=wind_gusts_10m,visibility&wind_speed_unit=mph&temperature_unit=fahrenheit
  &timezone=America/Los_Angeles&forecast_days=2
```
**Auth:** none. **CORS: `access-control-allow-origin: *`.** Verified live:
```json
{"time":"2026-08-29T08:00","interval":900,"temperature_2m":59.2,
 "wind_speed_10m":3.1,"wind_gusts_10m":11.0,"wind_direction_10m":94,"visibility":16600.0}
```
`visibility` (metres) + `wind_gusts_10m` is the closest thing to a free **dust proxy** that exists
for this location — a whiteout shows up as collapsing visibility. It is a *model* value, not a
sensor, so label it as forecast, not observation. 15-min update interval; poll 10–15 min.

## 8. Bluesky `searchPosts` ⭐ (browser-direct)

> ⚠️ Host matters. `https://public.api.bsky.app/...` returned **403 (BunnyCDN edge block)** from my
> IP on every attempt. `https://api.bsky.app/...` works fine and is the same AppView.

```
GET https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=%22burning%20man%22%20gate&limit=25&sort=latest
```
**Auth:** none. **CORS: `access-control-allow-origin: *`.** Verified live, 5 posts returned:
```
peter-butler.bsky.social  | 2026-08-28T22:09:36.290Z | Two interesting things (to me) here 1. This new policy for 2026…
keenethery.bsky.social    | 2026-08-28T13:49:36.698Z | Burning Man has started. We aren't attending this year. I'm receiving the Gravel to Gate times via X…
bnetherlands.bsky.social  | 2026-08-20T12:58:28.157Z | Another place that's apparently been struggling with fat bikes…
```
Volume is modest and unfiltered — treat as **human chatter, never as a wait-time source**. Poll 2–5 min.
Useful queries: `"gravel to gate"`, `"burning man" gate`, `brc gate wait`.

## 9. Gerlach webcam — `webcam.burningman.org` ⚠️

Found via the WP REST API on `burningman.org` (page 3468). Officially described as
*"a live image, refreshing once a minute, from a camera atop Bruno's Country Club in downtown
Gerlach, looking south toward Empire."* This is the **only camera anywhere on the 447 corridor.**

```
GET https://webcam.burningman.org/     → image/jpeg, ~148 KB, served by CloudFront
```
No auth. No `Access-Control-Allow-Origin` — but an `<img src>` does not need CORS, so it embeds
fine; you only need a proxy if you want to read pixels or check staleness client-side.

**⚠️ It is stale right now.** At probe time (15:03 UTC / 08:03 PT):
```
Last-Modified: Sat, 29 Aug 2026 08:32:41 GMT     (01:32 PT — ~6.5 hours old)
ETag: "24586-65a2b6991001c"
```
Two fetches 65 seconds apart returned **byte-identical images** (md5 `a827dc35…`). BM's own page
warns the camera is maintained by one staffer and *"may take a while to get back up and running
when it goes down."*

**Mandatory:** do a `HEAD`, read `Last-Modified`, and if it is older than ~10 minutes render
"camera offline — last image Xh ago" instead of presenting a 6-hour-old picture as live.
Cache-bust with `?t={epoch}`. Poll 60s.

## 10. NVRoads cameras — real, but not where you need them ⚠️

Nevada DOT's 511 site is a Castle Rock/CARS "OneStop" app (ASP.NET + DataTables), **not** ArcGIS.
No API key, no `X-Requested-With` strictly required.

**Camera positions (all 643, one call, no auth):**
```
GET https://www.nvroads.com/map/mapIcons/Cameras
→ {"item1":{…icon…},"item2":[{"itemId":"2","location":[39.484798,-119.852401],"icon":{},"title":""}, …]}
```

**Camera metadata incl. HLS video (DataTables, `length` is silently capped at 100 — paginate with `start`):**
```
POST https://www.nvroads.com/List/GetData/Cameras
Content-Type: application/x-www-form-urlencoded
draw=1&start=0&length=100
```
```json
{"draw":1,"recordsTotal":643,"recordsFiltered":643,"data":[{
 "DT_RowId":"2","id":2,"roadway":"McCarran & Caughlin/cashill","direction":"Unknown",
 "images":[{"id":2,"description":"McCarran & Caughlin/cashill","imageUrl":"/map/Cctv/2",
   "videoUrl":"https://d2wse2.its.nv.gov:443/renoxcd02/…_public.stream/playlist.m3u8",
   "videoType":"application/x-mpegURL"}],
 "latLng":{"geography":{"coordinateSystemId":4326,"wellKnownText":"POINT (-119.852401 39.484798)"}}}]}
```

**Live still image (this is the useful bit):**
```
GET https://www.nvroads.com/map/cctv/{id}   → content-type: image/jpeg  (returns the JPEG directly)
```
No auth, no CORS header (again: fine in an `<img>`). Poll 60s — the site's own
`resources.CameraRefreshRateMs = 60000`.

### ⚠️ The honest finding: there is no camera on NV-447

I pulled all 643 cameras and filtered geographically and by name. The **northernmost relevant
camera is at Wadsworth** — where you leave I-80 for 447. There is **nothing at Nixon, Empire, or
Gerlach, and nothing on 447 at all.**

| id | lat, lon | Name | Still |
|---|---|---|---|
| **7105** | 39.6024, -119.3357 | **I80 EB Wadsworth Truck Check** ← the 447 turnoff | `/map/cctv/7105` |
| 7137 | 39.6171, -119.2660 | I80 @ Fernley N E | `/map/cctv/7137` |
| 7138 | 39.6171, -119.2661 | I80 @ Fernley S W | `/map/cctv/7138` |
| 7211 | 39.5890, -119.4284 | I-80 @ Derby Dam | `/map/cctv/7211` |
| 7107 | 39.5660, -119.4867 | I80 @ USA Parkway | `/map/cctv/7107` |
| 7152 | 39.5528, -119.7526 | Pyramid @ York Way (Reno, 445 route) | `/map/cctv/7152` |
| 7123 | 39.5343, -119.7533 | I80 @ Pyramid Way (Reno) | `/map/cctv/7123` |

So NVRoads tells you about the **approach**, never about the queue. Camera 7105 is the single most
informative one: heavy traffic there is an early indicator, 60–90 min upstream of the gate.

## 11. NVRoads other layers — mostly disappointing

All are `POST /List/GetData/{layer}` with `draw=1&start=0&length=100`. No auth, no CORS (proxy).

| Layer | HTTP | Records | Corridor relevance |
|---|---|---|---|
| `Cameras` | 200 | 643 | See above |
| `Incidents` | 200 | **2 statewide** | Zero in corridor. Poll 5 min — a 447 incident here would be genuinely valuable |
| `Closures` | 200 | 11 | Zero in corridor |
| `RoadConditions` | 200 | 434 | ⚠️ **Stale — see below** |
| `MessageSigns` | 200 | 713 | 4 near Fernley; **all `message` fields currently empty** |
| `WeatherStations` | 200 | 185 | Nearest is **I-80 @ Derby Dam** — ~70 mi from Gerlach. Too far to be meaningful |
| `RestAreas` | 200 | 35 | Not useful |
| `Events` / `TrafficEvents` / `Roadwork` / `TrafficSpeeds` / `Alerts` / `Plows` | **500** | — | These layer names do not exist; the 500 is the app erroring, not a transient fault |

**`RoadConditions` for SR-447 exists but is abandoned:**
```json
{"id":50920,"area":"Reno","roadway":"SR-447","description":"From Gerlach, Nevada to California border",
 "primaryCondition":"No Report","secondaryConditions":[],"lastUpdated":"3/2/24, 11:18 AM"}
{"id":62656,"area":"Reno","roadway":"SR-447","description":"From I-80 to Tumbleweed St",
 "primaryCondition":"No Report","secondaryConditions":[],"lastUpdated":"2/14/25, 6:13 AM"}
```
`"No Report"`, last touched **2024 and Feb 2025**. **Do not surface this.** It is exactly the kind
of field that looks live (it has a `lastUpdated`!) and is not. `/map/mapIcons/TrafficSpeeds`
returns `{"item2":[]}` — NDOT publishes no speed data for this region either.

`MessageSigns` is worth a low-frequency poll *only* because NDOT sometimes posts event messaging
on I-80 near Fernley during Burning Man; all four corridor signs are blank today.

## 12. Mastodon (browser-direct)
```
GET https://mastodon.social/api/v1/timelines/tag/burningman?limit=20
```
No auth. **CORS `*`**. Rate limit is generous and exposed:
`x-ratelimit-limit: 300`, `x-ratelimit-remaining: 297`, `x-ratelimit-reset: 2026-08-29T15:05:00Z`.
Verified returning current posts (newest 2026-08-29T14:02:13Z). Note `/api/v2/search?type=statuses`
returns empty without auth — **use the hashtag timeline, not search.** Low volume; poll 5 min.

## 13. OSRM — baseline drive time only
```
GET https://router.project-osrm.org/route/v1/driving/-119.8138,39.5296;-119.3565,40.6535;-119.2065,40.7864?overview=false
```
No auth. **CORS `*`.** Verified: Reno → Gerlach → Gate = **196.1 km, 11536.6 s (3.20 h)**,
legs 126 min + 66 min.

⚠️ **OSRM has no traffic model whatsoever.** This number will not move when 40,000 vehicles queue.
Use it strictly as the free-flow denominator ("normally 3h 12m") against which the @bmantraffic
number is the delay. Poll once an hour at most — it is a volunteer demo server with fair-use limits
and no uptime guarantee.

**Keyed traffic-aware alternatives, all verified to reject unauthenticated calls:**
`api.tomtom.com` → **401** · `api.mapbox.com/directions/v5/mapbox/driving-traffic` → **401** ·
`router.hereapi.com` → **401** · Google Distance Matrix → 200 with
`"error_message":"You must use an API key to authenticate each request…"`.
Of these, **TomTom's free tier (2,500 req/day) is the most practical** if you want a real
traffic-aware Reno→Gerlach time; all require a server-side key.

## 14. ADS-B — aircraft over BRC (88NV)
```
GET https://api.adsb.lol/v2/lat/40.7538/lon/-119.2119/dist/25
GET https://opendata.adsb.fi/api/v2/lat/40.7538/lon/-119.2119/dist/25
```
No auth, no key. **No CORS header → proxy.** Both verified live:
```json
{"ac":[{"hex":"a3fe6a","type":"adsb_icao","flight":"N3567F  ","r":"N3567F","t":"C182",
        "alt_baro":8700,"alt_geom":8925,"gs":104.3,"track":175.60,"squawk":"1200"}]}
```
`api.airplanes.live` is **403** with a request to email them first — do not use it.
A fun, genuinely live "the airport is open" signal. Poll 60s.

## 15. burningman.org WordPress REST
`https://burningman.org/wp-json/` → 200 (site meta). `/wp/v2/posts` → `[]` (main site posts nothing).
`https://journal.burningman.org/wp-json/wp/v2/posts?per_page=10` → **200, real posts**
(newest at probe: id 72467, 2026-08-26). Pages endpoint is how I found the webcam:
`https://burningman.org/wp-json/wp/v2/pages?search=gerlach%20webcam`.
CORS is permitted by default on WP REST reads. Editorial cadence — poll hourly at most.
**There is no gate-status page on burningman.org**: `/gate-status/` → 404,
`/programs/black-rock-city/participate/getting-there/` → 404, and `bm.gate.status` does not resolve.
`api.burningman.org` responds 200 at root but exposes no discoverable versioned API (`/api/v1/` → 404).

---

# DEAD — do not build on these

## ❌ Reddit — blocked, and RSS is rate-limited into uselessness

| URL | Result |
|---|---|
| `https://www.reddit.com/r/BurningMan/new.json?limit=50` | **403** (browser UA *and* custom UA) |
| `https://www.reddit.com/r/BurningMan/search.json?q=gate&restrict_sr=1&sort=new` | **403** |
| `https://old.reddit.com/r/BurningMan/new.json` | **403** |
| `https://api.reddit.com/r/BurningMan/new` | **403** |
| `https://www.reddit.com/r/BurningMan.rss` | 200 (first call only) |
| `https://www.reddit.com/r/BurningMan/new/.rss?limit=25` | **429**, `x-ratelimit-remaining: 0.0`, `x-ratelimit-reset: 45` |

Reddit now blocks unauthenticated `.json` outright regardless of User-Agent, and the RSS fallback
exhausted its budget after a **single** request (`x-ratelimit-used: 1`, `remaining: 0.0`).

**On Vercel this gets worse, not better.** Serverless egress comes from shared cloud IP ranges that
Reddit rate-limits far more aggressively than residential ones. **The only supported path is OAuth**
(`https://oauth.reddit.com`, script-type app, client credentials, descriptive UA — 100 QPM). If you
are not prepared to register an app and store credentials, **drop Reddit from the design.**

## ❌ X / Twitter — no working free route to live @bmantraffic

This is the most important negative result, because @bmantraffic is the *original* source of the
gate times.

- **Nitter is gone.** `nitter.net` → **410 Gone**. `nitter.poast.org` → connection failure (000).
  `xcancel.com` → 400. The public instance ecosystem is dead.
- **`cdn.syndication.twimg.com/timeline/profile?screen_name=bmantraffic` → 200 with a
  ZERO-BYTE body.** Retried with `&dnt=true`: same. This endpoint is retired.
- **`syndication.twitter.com/srv/timeline-profile/screen-name/bmantraffic` → 200, 235 KB** of
  Next.js SSR HTML with a parseable `__NEXT_DATA__` blob containing 100 tweets. **This looks like a
  win and is a trap.** I parsed and date-sorted every entry:

  ```
  oldest: 2017-08-23   newest: 2025-08-26
  by year: {2023: 67, 2022: 10, 2019: 6, 2025: 6, 2018: 5, 2024: 5, 2017: 1}
  ```

  **Not one post from 2026.** It is a stale, engagement-ranked cache dominated by the 2023
  mudpocalypse ("Do not travel to Black Rock City!"). Polling this would render **three-year-old
  emergency closure notices as today's gate status** — the precise failure mode to avoid.
  No `Access-Control-Allow-Origin` either.
- `cdn.syndication.twimg.com/tweet-result?id={id}` **does** work and returns current data
  (verified against the live tweet id `2093713550128873614` → the 14:53:04Z "20 minutes" post).
  But you can only use it if you *already know the tweet id* — and the only free place to get
  current ids is `/api/feed/public`, which already hands you the full text. Circular; no value.

**Conclusion: BM's own dashboard feed is the only free live mirror of @bmantraffic.** Anything else
requires a paid X API tier ($200/mo Basic). Treat `/api/feed/public` as a single point of failure
and say "unavailable" when it fails, rather than substituting a stale mirror.

## ❌ Air quality / dust sensors — no free option near Gerlach
- `api.purpleair.com/v1/sensors?...` → **403** (key required; PurpleAir also charges for API points).
- `api.openaq.org/v3/locations?coordinates=40.6535,-119.3565&radius=25000` → **401**
  `{"message":"Unauthorized. A valid API key must be provided in the X-API-Key header."}`
- Windy's Point Forecast and Webcams APIs both require a registered key.

There is no regulatory or community air monitor near Gerlach. **Open-Meteo `visibility` (§7) is
the only free dust proxy** — and it is a model output, not a measurement. Label it accordingly.

## ❌ Other things checked and not found
- No public YouTube live stream for the gate. `burningman.org/live-webcast/` is the official
  destination and is driven by the Livepeer id in `/api/webcast-status` — which is `available:false`.
- `blackrockdesert.org` (Friends of Black Rock High Rock): fetched, 291 KB, **no webcam, no stream,
  no JSON feed** of any kind.
- OpenSnow / WeatherBug "Gerlach cams" surface in search results but are aggregator pages with no
  documented public JSON API and no camera actually in Gerlach.
- BMIR: `bmir.org/wp-json/` → **404** (not WordPress). No now-playing JSON anywhere —
  `stream.daz.radio/status-json.xsl` and `/live/status_json.xsl` both 404 into the SPA shell.
  Only the audio streams exist: `https://stream.daz.radio/live/playlist.m3u8` (HLS, verified 200,
  `#EXT-X-PROGRAM-DATE-TIME:2026-08-29T14:59:29`) and the iHeart mirror
  `https://stream.revma.ihrhls.com/zc8378`. **For "who is on air", use `synced.dj_schedule` from
  `/api/feed/public`** — it has epoch-ms set boundaries.

---

# Recommended architecture

**Everything worth having is either CORS-blocked or rate-limited, so run one server-side collector.**

```
Vercel cron / route handler (every 60s)
  ├─ GET /api/feed/public       (If-None-Match → 304s are free)   ── primary
  ├─ GET /api/gate-status       (30s)                             ── goes live at gate open
  ├─ GET /__data.json           (5 min)                           ── burn countdown, flags
  ├─ GET /api/webcast-status    (60s)
  ├─ HEAD webcam.burningman.org (60s — read Last-Modified, gate on freshness)
  ├─ POST nvroads /List/GetData/Incidents (5 min)
  └─ cache → KV / edge cache, serve one merged JSON to the browser

Browser may call directly (CORS `*`), no proxy needed:
  ├─ api.weather.gov/alerts/active?point=…   (5 min)
  ├─ api.open-meteo.com/v1/forecast          (15 min)
  ├─ api.bsky.app/xrpc/app.bsky.feed.searchPosts (5 min)
  └─ <img src="https://www.nvroads.com/map/cctv/7105?t={epoch}">   (60s)
```

**Non-negotiables for not shipping fake live data:**
1. Stamp every panel with the **source timestamp**, not fetch time. `synced.traffic[0].created_at`
   is up to an hour old by design.
2. Gate the Gerlach webcam on `Last-Modified` (it is 6.5h stale today).
3. Never render NVRoads `RoadConditions` for SR-447 — permanently `"No Report"` since 2024.
4. Never render the Twitter syndication timeline — newest post is Aug 2025.
5. Mirror BM's own `*_visibility` flags and the `feeds` health map; when `/api/feed/public` fails,
   say **"unavailable"**. There is no second live source for gate wait times.
