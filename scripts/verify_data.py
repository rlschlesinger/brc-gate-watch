#!/usr/bin/env python3
"""
Stress-test the shipped historical dataset against its raw sources.

Every check prints PASS/FAIL with the offending values, and the script exits
non-zero if anything fails. Run after any change to build_historical.py.
"""
import json, os, statistics, sys, collections, datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = lambda *p: os.path.join(ROOT, "data", *p)
PT = ZoneInfo("America/Los_Angeles")
fails, checks = [], 0


def check(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
        print(f"  FAIL  {name}  {detail}")
    return cond


def med(v):
    return round(statistics.median(v))


hist = json.load(open(D("historical.json")))
raw = open(D("bmantravel-source.js")).read()
BM = json.loads(raw[raw.index("{"):].rstrip().rstrip(";"))

print("=" * 72)
print("1. INTERNAL CONSISTENCY — every cell and day")
print("=" * 72)
for yr, y in hist["years"].items():
    for phase in ("arrival", "exodus"):
        for c in y[phase]["cells"]:
            tag = f"{yr}/{phase} {c['day']} {c['hour']}h"
            check(f"{tag} min<=median", c["min"] <= c["median"], f"{c['min']} > {c['median']}")
            check(f"{tag} median<=max", c["median"] <= c["max"], f"{c['median']} > {c['max']}")
            check(f"{tag} min<=mean<=max", c["min"] <= c["mean"] <= c["max"],
                  f"mean {c['mean']} outside [{c['min']},{c['max']}]")
            check(f"{tag} n>0", c["n"] > 0, f"n={c['n']}")
            check(f"{tag} hour in range", 0 <= c["hour"] < 24 and c["hour"] % 2 == 0, f"hour={c['hour']}")
            check(f"{tag} positive", c["min"] >= 0, f"min={c['min']}")
        for d in y[phase]["days"]:
            tag = f"{yr}/{phase} {d['label']}"
            check(f"{tag} min<=median<=max", d["min"] <= d["median"] <= d["max"],
                  f"[{d['min']},{d['median']},{d['max']}]")
            check(f"{tag} min<=mean<=max", d["min"] <= d["mean"] <= d["max"],
                  f"mean {d['mean']} outside [{d['min']},{d['max']}]")
            check(f"{tag} n>0", d["n"] > 0, f"n={d['n']}")

print("\n" + "=" * 72)
print("2. DAY STATS MUST EQUAL THE STATS OF THAT DAY'S CELLS' SOURCE READINGS")
print("=" * 72)
# Day min/max must bracket every cell in that day.
for yr, y in hist["years"].items():
    for phase in ("arrival", "exodus"):
        cells = collections.defaultdict(list)
        for c in y[phase]["cells"]:
            cells[c["day"]].append(c)
        for d in y[phase]["days"]:
            cs = cells.get(d["label"], [])
            if not cs:
                continue
            cmin, cmax = min(c["min"] for c in cs), max(c["max"] for c in cs)
            check(f"{yr}/{phase} {d['label']} day.min == min(cells)", d["min"] == cmin, f"{d['min']} vs {cmin}")
            check(f"{yr}/{phase} {d['label']} day.max == max(cells)", d["max"] == cmax, f"{d['max']} vs {cmax}")
            check(f"{yr}/{phase} {d['label']} day.n == sum(cell n)",
                  d["n"] == sum(c["n"] for c in cs), f"{d['n']} vs {sum(c['n'] for c in cs)}")

print("\n" + "=" * 72)
print("3. AGAINST THE RAW bmantravel SOURCE (2024 / 2025)")
print("=" * 72)
for yr in ("2024", "2025"):
    if yr not in BM or yr not in hist["years"]:
        continue
    for phase, key, keep in (("arrival", "in", lambda o: -3 <= o <= 4), ("exodus", "out", lambda o: o >= 5)):
        src_days = {d["offset"]: d for d in BM[yr][key]["days"] if keep(d["offset"])}
        got_days = {d["offset"]: d for d in hist["years"][yr][phase]["days"]}
        for off, sd in src_days.items():
            if sd["n"] < 2:
                continue
            gd = got_days.get(off)
            if not check(f"{yr}/{phase} offset {off} present", gd is not None, "missing"):
                continue
            vals = [int(v) for _, v in sd["readings"]] if sd.get("readings") else list(sd["hours"].values())
            check(f"{yr}/{phase} off{off} min", gd["min"] == min(vals), f"{gd['min']} vs {min(vals)}")
            check(f"{yr}/{phase} off{off} max", gd["max"] == max(vals), f"{gd['max']} vs {max(vals)}")
            check(f"{yr}/{phase} off{off} median", gd["median"] == med(vals), f"{gd['median']} vs {med(vals)}")
            check(f"{yr}/{phase} off{off} mean", gd["mean"] == round(statistics.fmean(vals)),
                  f"{gd['mean']} vs {round(statistics.fmean(vals))}")
            check(f"{yr}/{phase} off{off} n", gd["n"] == len(vals), f"{gd['n']} vs {len(vals)}")

print("\n" + "=" * 72)
print("4. CELL BUCKETS MATCH THE RAW READINGS THEY COVER")
print("=" * 72)
for yr in ("2024", "2025"):
    if yr not in BM:
        continue
    for phase, key, keep in (("arrival", "in", lambda o: -3 <= o <= 4), ("exodus", "out", lambda o: o >= 5)):
        got = {(c["day"], c["hour"]): c for c in hist["years"][yr][phase]["cells"]}
        for sd in BM[yr][key]["days"]:
            if not keep(sd["offset"]) or sd["n"] < 2:
                continue
            lab = "SUN open" if sd["offset"] == 0 else f"{sd['weekday']} {sd['offset']:+d}"
            buckets = collections.defaultdict(list)
            rows = sd["readings"] if sd.get("readings") else [[int(h), v] for h, v in sd["hours"].items()]
            for h, v in rows:
                buckets[(int(h) // 2) * 2].append(int(v))
            for h, vals in buckets.items():
                c = got.get((lab, h))
                if not check(f"{yr}/{phase} {lab} {h}h present", c is not None, "missing cell"):
                    continue
                check(f"{yr}/{phase} {lab} {h}h min", c["min"] == min(vals), f"{c['min']} vs {min(vals)}")
                check(f"{yr}/{phase} {lab} {h}h max", c["max"] == max(vals), f"{c['max']} vs {max(vals)}")
                check(f"{yr}/{phase} {lab} {h}h median", c["median"] == med(vals), f"{c['median']} vs {med(vals)}")
                check(f"{yr}/{phase} {lab} {h}h n", c["n"] == len(vals), f"{c['n']} vs {len(vals)}")

print("\n" + "=" * 72)
print("5. ORDERING / LABEL SANITY")
print("=" * 72)
for yr, y in hist["years"].items():
    offs = [d["offset"] for d in y["arrival"]["days"]]
    check(f"{yr} arrival days sorted", offs == sorted(offs), str(offs))
    check(f"{yr} arrival offsets in window", all(-3 <= o <= 4 for o in offs), str(offs))
    eoffs = [d["offset"] for d in y["exodus"]["days"]]
    check(f"{yr} exodus offsets >= 5", all(o >= 5 for o in eoffs), str(eoffs))
    for d in y["arrival"]["days"]:
        want = "SUN open" if d["offset"] == 0 else None
        if want:
            check(f"{yr} offset 0 labelled SUN open", d["label"] == want, d["label"])
        # date must actually fall `offset` days after that year's gate open
        gate = {2018: "2018-08-26", 2019: "2019-08-25", 2022: "2022-08-28",
                2024: "2024-08-25", 2025: "2025-08-24"}[int(yr)]
        delta = (datetime.date.fromisoformat(d["date"]) - datetime.date.fromisoformat(gate)).days
        check(f"{yr} {d['label']} date matches offset", delta == d["offset"], f"{d['date']} -> {delta} != {d['offset']}")

rk = hist.get("rankingYears", [])
for y in rk:
    n = sum(d["n"] for d in hist["years"][y]["arrival"]["days"])
    check(f"rankingYear {y} is dense", n >= 60, f"only {n} readings")
for y, v in hist["years"].items():
    n = sum(d["n"] for d in v["arrival"]["days"])
    if n >= 60:
        check(f"dense year {y} is in rankingYears", y in rk, f"{n} readings but excluded")

print("\n" + "=" * 72)
print("6. ARCHIVE-DERIVED YEARS (2018 / 2019 / 2022) REBUILT FROM SOURCE")
print("=" * 72)
GATE = {2018: "2018-08-26", 2019: "2019-08-25", 2022: "2022-08-28",
        2023: "2023-08-27", 2024: "2024-08-25", 2025: "2025-08-24"}
import re
EX = re.compile(r"\bexodus\b|gate to (pavement|gravel)|leaving (brc|black rock)|out to (gerlach|pavement)", re.I)
arc_path = D("bmantraffic-archive.json")
if os.path.exists(arc_path):
    samples = json.load(open(arc_path)).get("samples", [])
    rebuilt = collections.defaultdict(lambda: collections.defaultdict(list))
    for smp in samples:
        yr, mins, ts = smp.get("year"), smp.get("travel_time_minutes"), smp.get("timestamp_utc")
        if yr is None or mins is None or not ts or str(yr) in ("2024", "2025"):
            continue
        if smp.get("source") == "bmantravel-aggregate" or yr not in GATE:
            continue
        dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(PT)
        off = (dt.date() - datetime.date.fromisoformat(GATE[yr])).days
        phase = "exodus" if (smp.get("direction") == "exodus" or off >= 5) else "arrival"
        lab = "SUN open" if off == 0 else f"{dt.strftime('%a')} {off:+d}"
        rebuilt[(str(yr), phase)][(lab, (dt.hour // 2) * 2)].append(int(mins))

    for yr in ("2018", "2019", "2022"):
        if yr not in hist["years"]:
            continue
        for phase in ("arrival", "exodus"):
            got = {(c["day"], c["hour"]): c for c in hist["years"][yr][phase]["cells"]}
            want = rebuilt.get((yr, phase), {})
            shipped_days = {d["label"] for d in hist["years"][yr][phase]["days"]}
            for (lab, h), vals in want.items():
                if lab not in shipped_days:
                    continue  # day dropped by the min-readings threshold
                c = got.get((lab, h))
                if not check(f"{yr}/{phase} {lab} {h}h present", c is not None, "missing"):
                    continue
                check(f"{yr}/{phase} {lab} {h}h min", c["min"] == min(vals), f"{c['min']} vs {min(vals)}")
                check(f"{yr}/{phase} {lab} {h}h max", c["max"] == max(vals), f"{c['max']} vs {max(vals)}")
                check(f"{yr}/{phase} {lab} {h}h median", c["median"] == med(vals), f"{c['median']} vs {med(vals)}")
            for (lab, h) in got:
                check(f"{yr}/{phase} {lab} {h}h has a source", (lab, h) in want, "cell with no source reading")
else:
    print("  (archive file absent — skipped)")

print("\n" + "=" * 72)
print("7. NO EXODUS READING LEAKED INTO ARRIVAL, AND VICE VERSA")
print("=" * 72)
for yr, y in hist["years"].items():
    a = {d["offset"] for d in y["arrival"]["days"]}
    e = {d["offset"] for d in y["exodus"]["days"]}
    check(f"{yr} arrival/exodus offsets disjoint", not (a & e), f"overlap {a & e}")

print("\n" + "=" * 72)
print(f"{checks} checks, {len(fails)} failures")
print("=" * 72)
if fails:
    for f in fails[:25]:
        print("  -", f)
    sys.exit(1)
print("ALL PASS")
