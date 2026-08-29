# @bmantraffic historical gate wait times — archive recovery

Collected 2026-08-29T15:41:54Z. Machine-readable companion: `bmantraffic-archive.json`.

**685 samples**, every one carrying a real source URL and a verifiable timestamp.
Nothing here is estimated, interpolated, or reconstructed from memory.

## Coverage

| Year | Samples | Individual posts | Hourly buckets | Arrival rows | Local date span          | Max arrival (min) |
|------|---------|------------------|----------------|--------------|--------------------------|-------------------|
| 2018 | 134     | 134              | 0              | 110          | 2018-08-23 to 2018-09-03 | 510               |
| 2019 | 44      | 44               | 0              | 5            | 2019-08-25 to 2019-09-03 | 0                 |
| 2022 | 9       | 9                | 0              | 0            | 2022-09-04 to 2022-09-05 | -                 |
| 2023 | 1       | 1                | 0              | 1            | 2023-09-01 to 2023-09-01 | 45                |
| 2024 | 313     | 202              | 111            | 191          | 2024-08-22 to 2024-09-03 | 220               |
| 2025 | 184     | 9                | 175            | 117          | 2025-08-21 to 2025-09-02 | 500               |

Target years were 2025, 2024, 2023, 2022 and 2019. 2018 came along for free — Wayback archived
more individual @bmantraffic tweets from 2018 than from any other year — so it is included and labelled.

## How timestamps are exact

Every post ID is a Twitter snowflake and encodes its own creation time:

    milliseconds = (post_id >> 22) + 1288834974657

So `timestamp_utc` never depends on scraped page furniture. Decoding also proved that the
"Posted on:" strings rendered by the BRC Dashboard are **UTC, not playa local**. `local_time`
is UTC−7 (PDT).

## Two kinds of row — do not mix them

| sample_kind | meaning | years |
|---|---|---|
| `individual_post` | one real post, exact to the second | 2018, 2019, 2022, 2023, 2024, 2025 |
| `hourly_aggregate` | one hour-bucket from the bmantravel community aggregation | 2024, 2025 |

They **overlap for 2024 and 2025**. Filter to one `sample_kind` before charting or you will
double-count. For 2024 prefer `individual_post`; for 2025 the aggregate is the only broad coverage
that survives. Also split `direction` (`arrival` vs `exodus`) before charting — they are different phenomena.

## Median arrival wait by day, relative to gate opening

Day 0 is opening Sunday (gate opens 00:01). `n` is the number of samples in the bucket, so
you can see which cells are actually supported.

| Year | Thu-3      | Fri-2      | Sat-1      | Sun (open) | Mon+1      | Tue+2      | Wed+3     | Thu+4     |
|------|------------|------------|------------|------------|------------|------------|-----------|-----------|
| 2018 | 120 (n=10) | 180 (n=22) | 180 (n=22) | 240 (n=15) | 120 (n=18) | 30 (n=18)  | -         | -         |
| 2019 | -          | -          | -          | -          | -          | -          | -         | -         |
| 2022 | -          | -          | -          | -          | -          | -          | -         | -         |
| 2023 | -          | -          | -          | -          | -          | -          | -         | -         |
| 2024 | 60 (n=15)  | 180 (n=24) | 42 (n=18)  | 60 (n=31)  | 55 (n=20)  | 60 (n=18)  | 20 (n=13) | 20 (n=26) |
| 2025 | 80 (n=1)   | 128 (n=14) | 130 (n=17) | 390 (n=14) | 420 (n=14) | 285 (n=16) | 60 (n=5)  | 55 (n=17) |

## Median arrival wait by hour of day (opening Sunday + Monday, all years pooled)

| Playa hour | Median arrival wait (min) | n |
|------------|---------------------------|---|
| 00:00      | 150                       | 5 |
| 01:00      | 100                       | 5 |
| 02:00      | 255                       | 2 |
| 03:00      | 145                       | 4 |
| 04:00      | 240                       | 3 |
| 05:00      | 240                       | 3 |
| 06:00      | 88                        | 4 |
| 07:00      | 138                       | 4 |
| 08:00      | 35                        | 5 |
| 09:00      | 120                       | 8 |
| 10:00      | 180                       | 6 |
| 11:00      | 60                        | 9 |
| 12:00      | 60                        | 5 |
| 13:00      | 60                        | 7 |
| 14:00      | 270                       | 4 |
| 15:00      | 60                        | 7 |
| 16:00      | 60                        | 5 |
| 17:00      | 60                        | 4 |
| 18:00      | 70                        | 5 |
| 19:00      | 120                       | 3 |
| 20:00      | 60                        | 3 |
| 21:00      | 208                       | 6 |
| 22:00      | 45                        | 4 |
| 23:00      | 450                       | 1 |

## What could not be recovered

RECOVERED / NOT RECOVERED, year by year (target years were 2025, 2024, 2023, 2022, 2019).

2025 - PARTIAL. 9 individual timestamped posts (exact UTC decoded from the post ID, text
  from search-engine-indexed X page titles) plus 175 hour-resolution buckets from the bmantravel
  community aggregation. 117 arrival rows, 67 exodus rows, spanning Aug 21 - Sep 2.
  NOT recovered: the full primary hourly post series. brcdashboard.burningman.org switched to
  client-side rendering for 2025, so its Wayback snapshots are a 2.4KB empty JS shell with no feed
  in the HTML, its archived /__data.json is 93 bytes, and every 2025 twitter.com/bmantraffic capture
  is a 2-5KB login wall. The live /api/feed/public serves only the current year.

2024 - STRONG, and the best year here. 202 individual posts with exact per-post timestamps and
  per-post permalinks, from the server-side-rendered @bmantraffic panel embedded in 119 Wayback
  snapshots of brcdashboard.burningman.org, plus 111 hour-buckets from bmantravel.
  191 arrival rows, 122 exodus rows, Aug 22 - Sep 3.

2023 - ESSENTIALLY NOT RECOVERED. 1 sample only (Sep 1, 2023, 45 min to Gate), found via
  web search. brcdashboard did not exist yet (first Wayback capture 2024-08-23); Wayback holds only
  6 archived @bmantraffic tweet permalinks for 2023 and all fall Aug 20-22, before the gate
  opened; and the 2023 profile snapshots are post-login-wall SPA shells with no tweet text. The
  2023 mud-year arrival series does not appear to survive in any public archive reachable from here.

2022 - PARTIAL. Wayback holds 303 archived @bmantraffic tweet permalinks for 2022;
  38 were fetched and parsed within the time available, yielding 9 samples
  (0 arrival, 8 exodus). This year is fetch-limited, NOT extraction-limited:
  the method works (2022 pages carry the post text in the HTML <title>), so re-running the fetch
  loop over _scratch/tweet_list.txt will keep adding 2022 samples without any code change.
  Archived 2022 permalinks cover Aug 24 - Sep 6, so both arrival and exodus are reachable.

2019 - PARTIAL, and skewed by what was archived. Wayback holds 116 archived 2019 permalinks;
  107 fetched, giving 44 samples (5 arrival, 32 exodus).
  The archive itself is the constraint: only 8 of those 116 permalinks fall in the Aug 21-28 arrival
  window, the rest being Aug 31 - Sep 3 exodus. So 2019 exodus is reasonably covered and 2019
  ARRIVAL is close to a hole - not because extraction failed, but because those posts were never
  archived. Note also that several 2019 arrival readings are a genuine, explicitly stated ZERO
  ("there is currently no wait"), which is recorded as 0 minutes, not as missing data.

2018 - BONUS, not requested. Wayback archived more individual @bmantraffic permalinks for 2018
  (255) than for any other year, and 2018 pages are legacy server-rendered Twitter HTML, so
  extraction is clean: 134 samples, 110 of them arrival, covering Aug 23-28
  arrival plus Sep 2-3 exodus. Included and labelled.

CROSS-YEAR CAVEAT: @bmantraffic changed its wording repeatedly - "wait time at Gate", "travel time
from gravel to Gate", "travel time on Gate Road", "Exodus travel time on Gate Road to Gravel". The
measured road segment is therefore not identical across years, and 2018-2019 phrasing in particular
often describes the wait for Work Access Pass holders before the gate opens. Every sample keeps its
raw_text and matched_sentence so the wording can be checked before any cross-year comparison.


## Method

WHAT WORKED

1. Wayback snapshots of brcdashboard.burningman.org (the single biggest win, 2024).
   The 2024 dashboard was server-side rendered, and its HTML embeds the @bmantraffic panel with
   BOTH the post text and a per-post permalink. So each archived page yields ~15 posts, and 119
   snapshots collapse to 201 unique posts.
     curl -s "https://web.archive.org/cdx/search/cdx?url=brcdashboard.burningman.org&matchType=domain&output=json&limit=6000&filter=statuscode:200"
     curl -sSL --compressed "https://web.archive.org/web/20240826102754id_/https://brcdashboard.burningman.org/"
   Parse: <li><p>TEXT</p> ... href="https://x.com/bmantraffic/status/<ID>" ... Posted on: M/D/YYYY, h:mm:ss AM</p>

2. Wayback CDX over individual tweet permalinks (2018/2019/2022/2023).
     curl -s "https://web.archive.org/cdx/search/cdx?url=twitter.com/bmantraffic/status*&output=json&limit=800&collapse=urlkey"
   680 distinct archived tweet URLs. Text extraction differs by era, so the extractor tries three
   strategies in order: legacy <p class="TweetTextSize--jumbo"> (2018-19), og:description, then the
   <title> "Burning Man Traffic on Twitter: \"TEXT\" / Twitter" form (2022).

3. Twitter snowflake decoding - the key trick for exact timestamps.
   Every post ID encodes its own creation time: ms = (id >> 22) + 1288834974657.
   This gives exact UTC per sample with no dependence on archived page furniture, and it let me
   verify that brcdashboard's displayed "Posted on:" string is UTC (not playa local). Local time in
   this dataset is UTC-7 (PDT).

4. bmantravel.com - a community aggregation of @bmantraffic, found via web search.
   Its data is a plain JS global, no API needed:
     curl -sSL --compressed "https://www.bmantravel.com/data.js"   # window.BM_DATA = {...}
   Structured by year -> in/out -> day -> hour -> minutes, for 2024 and 2025. This is the main
   2025 source. VALIDATED against my primary 2024 posts: of 58 overlapping (date, hour) buckets,
   57 matched exactly and 1 was within 15 minutes, with zero disagreements - so its 2025 numbers
   are trustworthy as a faithful transcription.

5. Web search over indexed X page titles. X page titles contain the full post text, and the URL
   contains the ID, so a search hit yields (exact text + exact timestamp) without fetching X.
   This is how the 9 individual 2025 samples and the 1 individual 2023 sample were obtained.

WHAT FAILED, AND WHY

- Nitter / xcancel: nitter.net returns HTTP 410, nitter.poast.org does not resolve,
  nitter.privacydev.net refuses connections, and xcancel.com requires per-reader manual
  whitelisting by email ("RSS reader not yet whitelisted!"). No data.
- x.com CDX: "https://web.archive.org/cdx/search/cdx?url=x.com/bmantraffic*&matchType=prefix"
  returns []. Nothing is archived under the x.com hostname.
- 2023-2025 twitter.com/bmantraffic profile snapshots: all 2-5KB (or a 1.6MB SPA shell) containing
  "JavaScript is not available" / "Log in" and zero tweet text.
- 2025 brcdashboard snapshots: 2.4KB client-rendered shell; its /__data.json captures are 93 bytes
  ({"user":1}) with no feed. The live /api/feed/public works but serves only the current year.
- archive.today (archive.ph / .is / .today): HTTP 429 on every attempt.
- Reddit: blocked for the search tool; old.reddit.com search.rss works with a browser UA for one or
  two queries then returns 429, and the threads quote wait times only anecdotally, without the
  timestamps needed here.
- Prior-art charts on trippingly.net (gate-wait-by-year.png etc., credited to @j_houg) cover only
  2014-2017, so they are outside the requested years. No values were read off those images - reading
  numbers off a chart would be estimation, not measurement.

ENVIRONMENT NOTES (cost real time, worth recording)
- Python's urllib could not open sockets here ("Connection refused"); only curl reached the network.
- Sandbox throttling refuses connections after short bursts. The fix that worked was sequential
  curl with the wait pushed inside curl: --retry 8 --retry-delay 4 --retry-all-errors.
  Parallelism (xargs -P 6) made throughput worse, not better.
- Wayback's id_ (raw) endpoint returns stored gzip bytes: --compressed is required or you get binary.
- The shell here is zsh: unquoted $var does NOT word-split, and a failing curl aborts the loop
  unless you append "|| true".

HOW TO EXTEND
- Re-run assemble.py after fetching more of tweets/ ; it is idempotent and dedupes on tweet ID.
- The list of every archived tweet permalink is in _scratch/tweet_list.txt (ID:snapshot-timestamp).

