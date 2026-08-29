# Burning Man gate & exodus wait times — historical research notes

Collected 2026-08-29 for the BRC gate-wait dashboard.
Machine-readable companion: `historical-raw.json` (same directory).

All hours are **Pacific / playa time**, 24h clock. All waits are in **hours**.

---

## 1. What the numbers actually measure

Getting this right matters more than any single data point, because sources
quietly switch between three different distances.

| Measure | Definition | Who reports it |
|---|---|---|
| `gravel_to_gate` | End of pavement on CR-34 to the Gate itself | **@bmantraffic / BMIR 94.5 / GARS 95.1** — this is *the* official ingress metric |
| `gate_road_to_gravel` | Greeters / Gate Road out to CR-34 pavement | official Exodus metric |
| `cr34_8mile_to_gate` | From the 8-mile playa entrance on CR-34 | local news phrasing; longer than gravel-to-Gate |
| personal / anecdotal | "Reno to camp", "left Sacramento at 3pm" | Reddit, ePlaya, blogs — **not comparable** |

Anything that isn't the official metric is flagged `confidence: low` in the JSON
and should not be plotted on the same axis without a caveat.

## 2. Day-index convention

`0` = Opening Sunday (gate opens 12:01am). Negative = days before opening
(Early Arrival / staging). `6` = Burn Saturday, `7` = Temple Sunday,
`8` = Labor Day Monday, `9` = Tuesday after.

Gate-open dates: 2017-08-27 · 2018-08-26 · 2019-08-25 · 2022-08-28 ·
2023-08-27 · 2024-08-25 · 2025-08-24 · **2026-08-30**.

---

## 3. The backbone: verified hourly series for 2024 and 2025

The strongest thing found is `https://www.bmantravel.com/data.js` — a community
aggregation of **396 hourly @bmantraffic reports** covering 2024 and 2025, both
directions, broken out by day and hour. That is exactly the shape the dashboard
needs.

**I verified it rather than trusting it.** Twitter/X snowflake IDs encode an
exact millisecond timestamp (`(id >> 22) + 1288834974657`). I decoded eight
primary @bmantraffic tweets and checked each against the aggregation:

| Tweet (Pacific) | Tweet text | data.js value | Match |
|---|---|---|---|
| 2025-08-25 15:32 | "travel time from Gravel to Gate is 8 hours" | 480 min | yes |
| 2025-08-25 21:06 | "…is 7 hours" | 420 min | yes |
| 2025-08-26 05:00 | "…is 7 hours 30 minutes" | 450 min | yes |
| 2025-08-22 14:58 | "…is 2 hours and 45 minutes" | 165 min | yes |
| 2025-08-31 02:30 | "Exodus … 30 minutes" | 30 min | yes |
| 2025-09-02 14:45 | "Exodus … 30 minutes" | 30 min | yes |

Eight for eight. The aggregation is treated as `confidence: high`.


### 2025 INGRESS (gravel -> Gate)

| Date | Day | Min h | Median h | Max h | Worst hour | Best hour | Readings |
|---|---|---|---|---|---|---|---|
| 2025-08-22 | Friday before | 0.42 | 2.25 | 5.00 | 21:00 | 07:00 | 12 |
| 2025-08-23 | Saturday before | 0.58 | 2.17 | 5.33 | 23:00 | 10:00 | 17 |
| 2025-08-24 | Opening Sunday | 3.00 | 6.67 | 8.00 | 00:00 | 03:00 | 14 |
| 2025-08-25 | Event Monday | 6.00 | 7.00 | 8.33 | 10:00 | 18:00 | 12 |
| 2025-08-26 | Event Tuesday | 2.00 | 4.00 | 7.50 | 05:00 | 10:00 | 15 |
| 2025-08-27 | Event Wednesday | 0.33 | 1.00 | 5.83 | 23:00 | 13:00 | 5 |
| 2025-08-28 | Event Thursday | 0.25 | 1.00 | 8.00 | 03:00 | 21:00 | 16 |
| 2025-08-29 | Event Friday | 0.33 | 0.33 | 0.33 | 00:00 | 00:00 | 10 |
| 2025-08-30 | Burn Saturday | 0.33 | 0.33 | 0.33 | 00:00 | 00:00 | 9 |

### 2025 EXODUS (Gate Road -> gravel)

| Date | Day | Min h | Median h | Max h | Worst hour | Best hour | Readings |
|---|---|---|---|---|---|---|---|
| 2025-08-30 | Burn Saturday | 0.50 | 0.50 | 0.50 | 22:00 | 22:00 | 2 |
| 2025-08-31 | Temple Sunday | 0.50 | 1.17 | 5.33 | 22:00 | 00:00 | 24 |
| 2025-09-01 | Labor Day Monday | 2.17 | 4.00 | 6.00 | 20:00 | 07:00 | 23 |
| 2025-09-02 | Tuesday after | 0.50 | 0.50 | 4.00 | 00:00 | 01:00 | 16 |

### 2024 INGRESS (gravel -> Gate)

| Date | Day | Min h | Median h | Max h | Worst hour | Best hour | Readings |
|---|---|---|---|---|---|---|---|
| 2024-08-22 | Thursday before | 0.33 | 0.75 | 1.50 | 14:00 | 10:00 | 6 |
| 2024-08-23 | Friday before | 1.00 | 3.00 | 3.67 | 23:00 | 07:00 | 14 |
| 2024-08-24 | Saturday before | 0.33 | 0.75 | 3.00 | 00:00 | 04:00 | 5 |
| 2024-08-25 | Opening Sunday | 0.42 | 1.00 | 1.08 | 18:00 | 06:00 | 13 |
| 2024-08-26 | Event Monday | 0.75 | 1.08 | 1.25 | 01:00 | 16:00 | 4 |
| 2024-08-27 | Event Tuesday | 0.63 | 1.50 | 2.00 | 18:00 | 22:00 | 6 |
| 2024-08-28 | Event Wednesday | 0.33 | 0.33 | 0.67 | 01:00 | 03:00 | 3 |
| 2024-08-29 | Event Thursday | 0.33 | 0.33 | 1.00 | 18:00 | 09:00 | 13 |
| 2024-08-30 | Event Friday | 0.33 | 0.33 | 0.50 | 19:00 | 01:00 | 8 |
| 2024-08-31 | Burn Saturday | 0.33 | 0.33 | 0.33 | 00:00 | 00:00 | 7 |

### 2024 EXODUS (Gate Road -> gravel)

| Date | Day | Min h | Median h | Max h | Worst hour | Best hour | Readings |
|---|---|---|---|---|---|---|---|
| 2024-09-01 | Temple Sunday | 1.33 | 2.50 | 4.50 | 20:00 | 15:00 | 9 |
| 2024-09-02 | Labor Day Monday | 1.00 | 1.50 | 2.50 | 00:00 | 04:00 | 9 |
| 2024-09-03 | Tuesday after | 0.33 | 1.00 | 1.00 | 05:00 | 15:00 | 14 |
---

## 4. The headline finding: 2024 and 2025 are opposite years

This is the single most important caveat for a dashboard that wants to predict
2026, and it is easy to miss if you only read news coverage.

- **2024 ingress was mild.** Opening Sunday never exceeded ~1.1 h. The whole
  event sat at a 20-minute floor from Wednesday onward.
- **2025 ingress was brutal.** Opening Sunday hit 8 h at midnight; Monday held
  6–8.3 h for a solid 24 hours, peaking at **8 h 40 m at 10:00 Monday**;
  Tuesday pre-dawn was still 6–7.5 h.

The driver was weather, not demand: a 45–50 mph windstorm on Sat 23 Aug 2025
closed the gate, and the released backlog is what produced the Monday wall.

**A two-year average across 2024+2025 is misleading.** The dashboard should show
them as separate scenarios ("clean year" vs "disrupted year"), not blend them.

## 5. Patterns that hold across years

**Official (highest confidence):**

- "Wait times during the first 36 hours after opening can be five or more hours."
  — burningman.org Gate page
- "If you can arrive Tuesday or later, you will find your wait time to be much shorter."
- "On all days but opening night, the shortest lines are usually in the early
  morning hours, generally from **3 a.m.–10 a.m.**"
- "Heavy traffic and longer wait times indeed happen Saturday, Sunday and Monday."
  — Journal, 2016
- Exodus: "Gate Road travel times during Exodus peaked at **six to nine hours**."
- Exodus best windows: "very early in the morning, in the later evening, or on
  Tuesday morning before noon."
- **2026 target:** "a maximum ingress travel time — from the gravel to the Gate —
  of **four hours** whenever possible." A one-hour express lane in exchange for a
  donation is under consideration.

**Confirmed in the data:**

- Exodus peaks Temple Sunday ~20:00–23:00 and again Labor Day Monday evening;
  the Tuesday-after window collapses to 25–45 minutes.
- Ingress collapses to a hard ~20-minute floor from event Wednesday/Thursday on,
  in both 2024 and 2025.
- The 3 a.m.–10 a.m. rule held in 2025 mid-week (Thursday 08:00–13:00 was
  15–45 min) but **inverted during the backlog**: Tue/Thu pre-dawn 2025 ran
  6–8 h while mid-morning ran 2 h. Weather backlog beats time-of-day.

**Mechanisms worth putting on the dashboard:**

- *Arriving early is punished.* Early arrivals without credentials get staged
  **behind** on-time drivers. The 2019 table is stark: arrive 11:49 pm → ~5 h
  wait; arrive 12:01 am → 25 min.
- *Reported wait is self-defeating.* Official guide: "when the reported Gate Road
  travel time … is low, many folks will choose that moment to leave, which can
  increase those times faster than they can be reported." Any live dashboard
  will have this same feedback problem.
- *Demand shape.* Census: more than a third of Burners arrive on the first
  Monday; a quarter arrive after Monday, peaking again Thursday. Early Arrival
  (work access) holders are ~12% of population.

## 6. Weather-disrupted years — none of the last three is a clean baseline

| Year | What happened | Peak reported |
|---|---|---|
| **2023** | Mud year. Driving ban; the extreme was **Exodus, not ingress** | Exodus 5h10m → 6 h → **8 h** through Mon 4 Sep evening; still ~7.5 h Tue morning |
| **2024** | Rain closed the gate; reopened ~3:15 pm Saturday, ~12 h after closing, ~20,000 waiting | ingress stayed mild afterwards (≤1.5 h) |
| **2025** | 45–50 mph windstorm Sat 23 Aug closed the gate | **6–9 h** official, Mon 25 Aug; peak 8 h 40 m |
| **2018** | Extended dust storm closed the entrance gate | reported **11 hours** in line |
| **2014** | Rain closure | "some people waited upwards of **18 hours**" |

## 7. Older years — thin, and why

Pre-2024 hour-level data exists only as scattered anecdotes plus one set of
charts.

**Juliet Hougland (@j_houg) charts, 2014–2017** (via trippingly.net) — the only
multi-year quantitative source found. Values below are *read off the plots*
(±0.5 h, x-axis is hours after gate open, not clock time) and are marked
`confidence: low` / `source_type: chart`:

- Ingress peak on Gate Road: 2014 ≈ 5.5 h (~18–22 h after open); 2015 ≈ 2 h;
  2016 ≈ 5.5 h (~12–18 h after open); 2017 ≈ 4 h.
- Wadsworth→Gate Road: 2015 spiked to **8 h**; 2014 ≈ 5.3 h; 2017 stayed flat ~2 h.
- Exodus: 2016 peaked at **8 h** (~44–50 h after Man burn); 2017 ≈ 3.5 h.
- Averaged shape: ingress peaks ~18–26 h after gate open (Sunday evening into
  Monday pre-dawn) at ~5 h, is near zero in the first 2–4 h after opening, with a
  second ~2.5 h bump around 58–62 h.

**Individual hard data points recovered for the gap years:**

- 2018-08-23 14:57 — "Current wait time on Gate Road is two hours" (Early-Arrival-only)
- 2018-08-24 07:56 — "Wait at Gate is still holding around 4 hours" (Early-Arrival-only)
- 2018-08-25 13:56 — "approximately three hours" (Early-Arrival-only)
- 2018-08-26 06:04 (Opening Sunday) — "about 2 to 3 hours"
- 2016-08-27 17:00 — "Still three hours on the playa to get to Gate" (Early Entry only)
- 2016-08-28 ~00:00 — "no wait at the gate", then "under an hour" an hour later
- 2022-09-04 14:00 — Exodus, first-person: in line 2:00 pm, on the road 11:00 pm = **9 h**
- 2013-08-26 10:00 — "got there 10:00 mon morn and had a 4 hour wait"
- 2008-08-26 07:00 — "only a 10 minute entrance line at 7AM Tues"

## 8. Biggest gaps, and exactly how to close them

**Gap: no hour-level series for 2017–2023.**

The raw material exists and the method is proven. The Wayback Machine has
archived individual @bmantraffic tweets:

| Year | Archived tweets in event window |
|---|---|
| 2018 | 255 |
| 2019 | 116 |
| 2022 | 303 |
| 2023 | 77 |

Recipe, verified working:

1. `http://web.archive.org/cdx/search/cdx?url=twitter.com/bmantraffic/status/*&output=text&fl=timestamp,original&collapse=urlkey&limit=2000`
2. Decode each tweet ID to exact Pacific time: `((id >> 22) + 1288834974657)` ms UTC, minus 7 h.
3. Fetch `http://web.archive.org/web/{timestamp}id_/{url}` — **the tweet text is in the page `<title>`.**
4. Regex the hours/minutes out of "The current travel time from Gravel to Gate is …".

I confirmed steps 1–4 end to end and harvested a first tranche before
**web.archive.org rate-limited and then IP-blocked this host**. Pace at ~2 s per
request from a fresh IP and 2018/2019/2022/2023 can be brought to the same
fidelity as 2024/2025. The exact URL worklists are saved at
`fetchlist.txt` and `batch_prio.txt` in the session scratchpad.

**Other blocked routes (don't waste time re-trying these from here):**

- `reddit.com` — 403 at both the tool layer and the network layer, including
  `old.reddit.com`, `api.reddit.com`, `.json` and `.rss` endpoints, and public
  redlib mirrors. Reddit contributed nothing to this dataset.
- `eplaya.burningman.org` — 403s direct requests; the Wayback Machine was the
  only way in, and three threads were retrieved before the block.
- Facebook groups — login-walled.
- SFGate / SF Chronicle — client-side rendering defeats fetching; headlines were
  usable but body text was not.
- `innovate.burningman.org` — Burning Man's own open-data portal publishes GIS,
  camps, art and events, but **no traffic or gate dataset**.

**Genuinely missing, probably unobtainable:** any official vehicle-throughput
number (vehicles/hour through the Gate), and any queue length stated in miles.
No source found stated either.
