/* End-to-end assertions against the deployed /api/live. */
const BASE = process.env.BASE ?? "https://brc-gate-watch.vercel.app";
let pass = 0, fail = 0;
const t = (n, ok, d = "") => { if (ok) pass++; else { fail++; console.log(`  FAIL  ${n}  ${d}`); } };

const r = await fetch(`${BASE}/api/live`, { cache: "no-store" });
t("live responds 200", r.ok, `HTTP ${r.status}`);
const d = await r.json();
const now = Date.now();

t("payload flagged ok", d.ok === true);
t("has readings", Array.isArray(d.toc) && d.toc.length > 0, `${d.toc?.length} samples`);

for (const s of d.toc ?? []) {
  const at = Date.parse(s.at);
  t(`sample ${s.at} not in the future`, at <= now + 120_000, `${(at - now) / 60000 | 0}m ahead`);
  t(`sample ${s.at} within 30h`, now - at < 30 * 3600_000);
  t(`sample ${s.at} plausible`, s.minutes >= 0 && s.minutes <= 24 * 60, `${s.minutes}m`);
  t(`sample ${s.at} has a source`, s.source === "toc" || s.source === "bmantraffic", s.source);
}

const sorted = [...(d.toc ?? [])].map(s => s.at).sort();
t("readings ascending", JSON.stringify(sorted) === JSON.stringify((d.toc ?? []).map(s => s.at)));

const last = d.toc?.[d.toc.length - 1];
if (last) {
  t("current matches newest reading", d.current.minutes === last.minutes && d.current.at === last.at,
    `current ${d.current.minutes}@${d.current.at} vs last ${last.minutes}@${last.at}`);
}

for (const p of d.traffic ?? []) {
  if (p.minutes !== null) t(`tweet parse plausible: ${p.text.slice(0, 40)}`, p.minutes >= 0 && p.minutes <= 1440, `${p.minutes}`);
  t(`tweet timestamp sane: ${p.id}`, Date.parse(p.createdAt) <= now + 120_000);
}

// Every @bmantraffic post that states a travel time must have been parsed.
const unparsed = (d.traffic ?? []).filter(p => /travel time/i.test(p.text) && !/gate\s+to\s+(gravel|pavement)/i.test(p.text) && p.minutes === null);
t("no travel-time post left unparsed", unparsed.length === 0, unparsed.map(p => p.text).join(" | "));

t("archive is growing", (d.archiveCount ?? 0) >= (d.toc?.length ?? 0),
  `archive ${d.archiveCount} < window ${d.toc?.length}`);
t("source health reported", Object.keys(d.sourceHealth ?? {}).length >= 8);
for (const c of d.cameras ?? []) {
  t(`camera ${c.id} age sane`, c.ageSec === null || (c.ageSec >= 0 && c.ageSec < 60 * 86400), `${c.ageSec}`);
}
if (d.conditions) {
  t("visibility non-negative", d.conditions.visibilityM === null || d.conditions.visibilityM >= 0);
  t("dust label known", ["calm", "dusty", "whiteout", "unknown"].includes(d.conditions.dust), d.conditions.dust);
}
t("gate flags boolean", typeof d.flags?.gateVisible === "boolean" && typeof d.flags?.placeholderMode === "boolean");

console.log(`\n${pass + fail} assertions, ${fail} failures`);
process.exit(fail ? 1 : 0);
