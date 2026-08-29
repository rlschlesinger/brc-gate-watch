/** Wait-time ramp, shared by every chart. Thresholds come from the design system. */
export const RAMP = ["var(--r1)", "var(--r2)", "var(--r3)", "var(--r4)", "var(--r5)"] as const;
export const RAMP_LABELS = ["under 45m", "45–90m", "1.5–2.5h", "2.5–4h", "4h+"] as const;

export function waitColor(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || !Number.isFinite(mins)) return "var(--rule)";
  if (mins < 45) return RAMP[0];
  if (mins < 90) return RAMP[1];
  if (mins < 150) return RAMP[2];
  if (mins < 240) return RAMP[3];
  return RAMP[4];
}

/** One word for the hero, matching the ramp band. */
export function waitWord(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || !Number.isFinite(mins)) return "no data";
  if (mins < 45) return "moving";
  if (mins < 90) return "normal";
  if (mins < 150) return "slow";
  if (mins < 240) return "heavy";
  return "brutal";
}

/** Big-format clock, e.g. 220 -> "3:40", 40 -> "0:40". */
export function fmtClock(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—:—";
  const t = Math.max(0, Math.round(m));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function fmtMins(m: number | null | undefined): string {
  if (m === null || m === undefined || !Number.isFinite(m)) return "—";
  const t = Math.round(m);
  if (t < 60) return `${t}m`;
  const h = Math.floor(t / 60);
  const r = t % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
