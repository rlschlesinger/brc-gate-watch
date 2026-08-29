#!/usr/bin/env python3
"""
Pull @bmantraffic posts out of archived brcdashboard snapshots.

The Wayback captures embed the raw API payload the dashboard was serving at the
time, so each post carries its own tweet id and a UTC `created_at` — far more
trustworthy than scraping the rendered page, whose clock depends on how the
archiver rendered it.
"""
import json, re, sys, glob, os

TWEET = re.compile(
    r'\{id:"(?P<id>\d+)",text:"(?P<text>(?:[^"\\]|\\.)*)"'
    r'.*?created_at:"(?P<at>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)"',
    re.S,
)

def unescape(s: str) -> str:
    return json.loads(f'"{s}"')

def collect(paths):
    seen = {}
    for p in paths:
        try:
            html = open(p, encoding="utf-8", errors="replace").read()
        except OSError:
            continue
        for m in TWEET.finditer(html):
            try:
                txt = unescape(m.group("text"))
            except Exception:
                txt = m.group("text")
            seen[m.group("id")] = {"id": m.group("id"), "text": txt, "at": m.group("at"), "src": os.path.basename(p)}
    return sorted(seen.values(), key=lambda r: r["at"])

if __name__ == "__main__":
    roots = sys.argv[1:] or ["data/_scratch/snaps2/*.html", "data/_scratch/snaps/*.html", "data/_scratch/*.html"]
    files = [f for r in roots for f in glob.glob(r)]
    rows = collect(files)
    print(f"scanned {len(files)} files, {len(rows)} unique posts", file=sys.stderr)
    json.dump(rows, sys.stdout, indent=1)
