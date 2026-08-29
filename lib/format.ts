export function fmtMins(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function fmtHoursShort(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  const h = m / 60;
  return h >= 10 ? `${Math.round(h)}h` : `${(Math.round(h * 10) / 10).toString().replace(/\.0$/, "")}h`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Wait-time colour ramp, shared by the live chart and the historical heatmap. */
export function waitColor(mins: number | null): string {
  if (mins === null || !Number.isFinite(mins)) return "rgba(255,255,255,.06)";
  const stops: [number, string][] = [
    [0, "#3fae6d"], [45, "#8ec54f"], [90, "#e3c341"],
    [180, "#ef9a3c"], [300, "#e4623a"], [480, "#b8323c"], [720, "#7a1f33"],
  ];
  if (mins <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (mins <= stops[i][0]) return mix(stops[i - 1], stops[i], mins);
  }
  return stops[stops.length - 1][1];
}

function mix(a: [number, string], b: [number, string], v: number): string {
  const t = (v - a[0]) / (b[0] - a[0]);
  const pa = hex(a[1]);
  const pb = hex(b[1]);
  const c = pa.map((x, i) => Math.round(x + (pb[i] - x) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hex(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
