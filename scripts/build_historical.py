#!/usr/bin/env python3
"""
Build data/historical.json.

Primary source is bmantravel.com's aggregation of @bmantraffic's hourly posts
(data/bmantravel-source.js), which the research pass verified reading-by-reading
against tweet snowflake timestamps. Years are kept SEPARATE on purpose: 2024 and
2025 were opposite years (2024 rain-delayed but fast once open, 2025 crushed by a
windstorm closure), so a pooled median would describe a year that never happened.
"""
import datetime, json, os, statistics, sys
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, "data", *p)
BUCKET = 2
PT = ZoneInfo("America/Los_Angeles")

YEAR_NOTES = {
    "2025": "Windstorm on the Saturday closed the Gate; the backlog held 6–8h for a full day.",
    "2024": "Rain closed the Gate for ~12h on the Friday, but once open it stayed under ~1h.",
    "2022": "First full-size year after the pandemic pause. Sparse coverage — treat as indicative.",
    "2019": "The last pre-pandemic year, and the cleanest weather of the set.",
    "2018": "Recovered from archived posts; mostly the early-arrival and opening days.",
}

GATE_OPEN = {
    2018: "2018-08-26", 2019: "2019-08-25", 2022: "2022-08-28",
    2023: "2023-08-27", 2024: "2024-08-25", 2025: "2025-08-24", 2026: "2026-08-30",
}
# Years whose hourly series comes from the bmantravel aggregation instead.
AGGREGATED_YEARS = {"2024", "2025"}
MIN_READINGS = 20


def load_bm_data():
    raw = open(D("bmantravel-source.js")).read()
    return json.loads(raw[raw.index("{"):].rstrip().rstrip(";"))


def day_label(offset: int, weekday: str) -> str:
    if offset == 0:
        return "SUN open"
    return f"{weekday} {offset:+d}"


MIN_DAY_READINGS = 2
MIN_PHASE_READINGS = 5


def stats_of(vals):
    """Every statistic the UI can switch between, from one list of readings."""
    return {
        "median": round(statistics.median(vals)),
        "mean": round(statistics.fmean(vals)),
        "min": min(vals),
        "max": max(vals),
        "n": len(vals),
    }


def day_readings(d):
    """(hour, minutes) pairs for a day, preferring raw readings over pre-medians."""
    if isinstance(d.get("readings"), list) and d["readings"]:
        return [(int(h), int(v)) for h, v in d["readings"]]
    return [(int(h), int(v)) for h, v in (d.get("hours") or {}).items()]


def build_direction(year_block, keep):
    """keep(offset) decides which days belong to this phase."""
    days, cells = [], []
    for d in year_block["days"]:
        if not keep(d["offset"]) or d["n"] < MIN_DAY_READINGS:
            continue
        lab = day_label(d["offset"], d["weekday"])
        rows = day_readings(d)
        if not rows:
            continue
        buckets = {}
        for h, v in rows:
            buckets.setdefault((h // BUCKET) * BUCKET, []).append(v)
        for h, vals in sorted(buckets.items()):
            cells.append({"day": lab, "hour": h, **stats_of(vals)})
        allv = [v for _, v in rows]
        days.append({
            "label": lab, "offset": d["offset"], "date": d["date"], **stats_of(allv),
        })
    days.sort(key=lambda x: x["offset"])
    # A phase built from one or two stray posts describes nothing; drop it so the
    # UI says "not recovered" instead of drawing a confident line through noise.
    if sum(d["n"] for d in days) < MIN_PHASE_READINGS:
        return [], []
    return days, cells


def fmt_hour(h: int) -> str:
    return f"{h % 12 or 12}{'am' if h < 12 else 'pm'}"


def fmt_mins(m: int) -> str:
    if m < 60:
        return f"{m}m"
    h, r = divmod(round(m), 60)
    return f"{h}h {r}m" if r else f"{h}h"


def load_extra_insights():
    """Sourced statements from the research pass that a chart cannot carry."""
    out, srcs = [], []
    p = D("historical-raw.json")
    if not os.path.exists(p):
        return out, srcs
    raw = json.load(open(p))
    for pat in raw.get("patterns", [])[:40]:
        claim = (pat.get("claim") or "").strip()
        if not claim:
            continue
        out.append({"text": claim, "sourceUrl": pat.get("source_url"), "years": pat.get("years")})
    seen = set()
    for o in raw.get("observations", []):
        u = o.get("source_url")
        if u and u not in seen and o.get("confidence") == "high":
            seen.add(u)
            srcs.append({"title": o.get("source_type", "source"), "url": u, "year": o.get("year")})
    return out, srcs[:40]


def load_archive_years():
    """Per-year day/hour blocks recovered from archived posts (2018/2019/2022)."""
    import collections
    p = D("bmantraffic-archive.json")
    if not os.path.exists(p):
        return {}
    samples = json.load(open(p)).get("samples", [])
    by_year = collections.defaultdict(lambda: {"arrival": [], "exodus": []})

    for s in samples:
        yr = s.get("year")
        mins = s.get("travel_time_minutes")
        ts = s.get("timestamp_utc")
        if yr is None or mins is None or not ts or str(yr) in AGGREGATED_YEARS:
            continue
        if s.get("source") == "bmantravel-aggregate":
            continue  # already covered by the primary aggregation
        try:
            dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(PT)
        except ValueError:
            continue
        if yr not in GATE_OPEN:
            continue
        offset = (dt.date() - datetime.date.fromisoformat(GATE_OPEN[yr])).days
        phase = "exodus" if (s.get("direction") == "exodus" or offset >= 5) else "arrival"
        if s.get("direction") == "unknown" and offset >= 5:
            phase = "exodus"
        by_year[str(yr)][phase].append({
            "offset": offset, "weekday": dt.strftime("%a"), "date": dt.date().isoformat(),
            "hour": dt.hour, "minutes": int(mins),
        })

    out = {}
    for yr, phases in by_year.items():
        if len(phases["arrival"]) + len(phases["exodus"]) < MIN_READINGS:
            continue
        block = {}
        for phase, rows in phases.items():
            days = collections.defaultdict(list)
            for r in rows:
                days[(r["offset"], r["weekday"], r["date"])].append(r)
            out_days = []
            for (offset, wd, date), rs in sorted(days.items()):
                hours = collections.defaultdict(list)
                for r in rs:
                    hours[str(r["hour"])].append(r["minutes"])
                out_days.append({
                    "date": date, "weekday": wd, "offset": offset,
                    "hours": {h: round(statistics.median(v)) for h, v in hours.items()},
                    "readings": [[r["hour"], r["minutes"]] for r in rs],
                    "median": round(statistics.median([r["minutes"] for r in rs])),
                    "min": min(r["minutes"] for r in rs), "max": max(r["minutes"] for r in rs),
                    "n": len(rs),
                })
            block[phase] = {"days": out_days}
        out[yr] = block
    return out


def main():
    bm = load_bm_data()
    archive = load_archive_years()
    years = {}
    ordered = [y for y in ("2025", "2024") if y in bm] + sorted(archive, reverse=True)
    for y in ordered:
        if y in bm:
            src_in, src_out = bm[y]["in"], bm[y].get("out", {"days": []})
        else:
            src_in = archive[y].get("arrival", {"days": []})
            src_out = archive[y].get("exodus", {"days": []})
        ing_days, ing_cells = build_direction(src_in, lambda o: -3 <= o <= 4)
        out_days, out_cells = build_direction(src_out, lambda o: o >= 5)
        years[y] = {
            "label": y, "note": YEAR_NOTES.get(y, ""),
            "arrival": {"days": ing_days, "cells": ing_cells},
            "exodus": {"days": out_days, "cells": out_cells},
        }

    years = {y: v for y, v in years.items()
             if v["arrival"]["days"] or v["exodus"]["days"]}

    day_order, seen = [], set()
    for y in years.values():
        for d in y["arrival"]["days"]:
            if d["label"] not in seen:
                seen.add(d["label"])
                day_order.append((d["offset"], d["label"]))
    day_order = [l for _, l in sorted(day_order)]

    insights, sources = load_extra_insights()

    # Headline contrast, computed rather than asserted.
    head = []
    if "2025" in years and "2024" in years:
        def open_day(y):
            return next((d for d in years[y]["arrival"]["days"] if d["offset"] == 0), None)
        a, b = open_day("2025"), open_day("2024")
        if a and b:
            head.append({
                "text": f"Opening Sunday is the least predictable day of the week: a typical "
                        f"{fmt_mins(a['median'])} in 2025 versus {fmt_mins(b['median'])} in 2024. "
                        f"The difference was weather, not demand — treat the two years as separate "
                        f"scenarios rather than averaging them.",
            })
    out = {
        "status": "ok",
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "coverageYears": sorted(int(y) for y in years),
        "defaultYear": "2025",
        # Only years with a dense hourly series are used to rank arrival windows;
        # the thin ones would otherwise let a single lucky reading win.
        "rankingYears": [y for y, v in years.items()
                         if sum(d["n"] for d in v["arrival"]["days"]) >= 60],
        "days": day_order,
        "years": years,
        "insights": head + insights,
        "sources": sources,
        "primarySource": {
            "title": "bmantravel.com aggregation of @bmantraffic hourly posts",
            "url": "https://bmantravel.com/",
        },
    }
    json.dump(out, open(D("historical.json"), "w"), indent=1)
    tot = sum(d["n"] for y in years.values() for d in y["arrival"]["days"] + y["exodus"]["days"])
    print(f"wrote historical.json: years {list(years)}, {tot} readings, {len(insights)} patterns", file=sys.stderr)


if __name__ == "__main__":
    main()
