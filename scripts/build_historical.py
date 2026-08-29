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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, "data", *p)
BUCKET = 2

YEAR_NOTES = {
    "2025": "Windstorm on the Saturday closed the Gate; the backlog held 6–8h for a full day.",
    "2024": "Rain closed the Gate for ~12h on the Friday, but once open it stayed under ~1h.",
}


def load_bm_data():
    raw = open(D("bmantravel-source.js")).read()
    return json.loads(raw[raw.index("{"):].rstrip().rstrip(";"))


def day_label(offset: int, weekday: str) -> str:
    if offset == 0:
        return "SUN open"
    return f"{weekday} {offset:+d}"


def build_direction(year_block, keep):
    """keep(offset) decides which days belong to this phase."""
    days, cells = [], []
    for d in year_block["days"]:
        if not keep(d["offset"]):
            continue
        lab = day_label(d["offset"], d["weekday"])
        buckets = {}
        for h, v in d["hours"].items():
            buckets.setdefault((int(h) // BUCKET) * BUCKET, []).append(v)
        for h, vals in sorted(buckets.items()):
            cells.append({"day": lab, "hour": h, "typical": round(statistics.median(vals)), "n": len(vals)})
        quiet = min(buckets.items(), key=lambda kv: statistics.median(kv[1])) if buckets else None
        days.append({
            "label": lab, "offset": d["offset"], "date": d["date"],
            "typical": d["median"], "peak": d["max"], "floor": d["min"], "n": d["n"],
            "note": (f"{d['n']} readings · quietest around {fmt_hour(quiet[0])} "
                     f"({round(statistics.median(quiet[1]))}m)") if quiet else f"{d['n']} readings",
        })
    days.sort(key=lambda x: x["offset"])
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


def main():
    bm = load_bm_data()
    years = {}
    for y in ("2025", "2024"):
        if y not in bm:
            continue
        ing_days, ing_cells = build_direction(bm[y]["in"], lambda o: -3 <= o <= 4)
        out_days, out_cells = build_direction(bm[y].get("out", {"days": []}), lambda o: o >= 5)
        years[y] = {
            "label": y, "note": YEAR_NOTES.get(y, ""),
            "arrival": {"days": ing_days, "cells": ing_cells},
            "exodus": {"days": out_days, "cells": out_cells},
        }

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
                        f"{fmt_mins(a['typical'])} in 2025 versus {fmt_mins(b['typical'])} in 2024. "
                        f"The difference was weather, not demand — treat the two years as separate "
                        f"scenarios rather than averaging them.",
            })
    out = {
        "status": "ok",
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "coverageYears": sorted(int(y) for y in years),
        "defaultYear": "2025",
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
