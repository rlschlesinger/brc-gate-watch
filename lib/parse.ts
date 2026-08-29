import type { WaitSample, TrafficPost } from "./types";

/**
 * @bmantraffic posts hourly in the shape
 *   "The current travel time from Gravel to Gate is 2 hours, 30 minutes. 🚗"
 * with a lot of incidental variation in punctuation, emoji and conjunctions.
 */
export function parseTravelMinutes(text: string): number | null {
  const t = text.toLowerCase().replace(/[‘’]/g, "'");
  if (!/travel time/.test(t)) return null;
  // Only trust the Gravel -> Gate direction; Exodus posts read the other way.
  if (/gate\s+to\s+gravel/.test(t)) return null;

  const after = t.split(/\bis\b/).slice(1).join(" is ");
  const scope = after || t;

  const h = scope.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/);
  const m = scope.match(/(\d+)\s*(?:minutes?|mins?|m\b)/);
  if (!h && !m) {
    if (/\bless than (?:an? )?hour\b/.test(scope)) return 45;
    if (/\bno wait\b|\bnone\b|\bclear\b/.test(scope)) return 0;
    return null;
  }
  const mins = (h ? Math.round(parseFloat(h[1]) * 60) : 0) + (m ? parseInt(m[1], 10) : 0);
  return Number.isFinite(mins) ? mins : null;
}

/** "0 h, 40 m" / "2 h, 0 m" / "1h 15m" -> minutes */
export function parseTocDuration(s: string): number | null {
  if (!s) return null;
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  if (!h && !m) return null;
  return (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
}

const PT = "America/Los_Angeles";

/** Pacific-time clock parts for an instant, without pulling in a date library. */
function ptParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: PT, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const { type, value } of f.formatToParts(d)) p[type] = value;
  return {
    y: +p.year, mo: +p.month, d: +p.day,
    h: p.hour === "24" ? 0 : +p.hour, mi: +p.minute,
  };
}

/** Offset in minutes between UTC and Pacific at a given instant (handles DST). */
function ptOffsetMinutes(d: Date): number {
  const p = ptParts(d);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** Build the instant for a Pacific wall-clock time on a given Pacific calendar day. */
function ptInstant(y: number, mo: number, d: number, h: number, mi: number): Date {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  for (let i = 0; i < 3; i++) {
    const off = ptOffsetMinutes(guess);
    const next = new Date(Date.UTC(y, mo - 1, d, h, mi) - off * 60000);
    if (next.getTime() === guess.getTime()) break;
    guess = next;
  }
  return guess;
}

/**
 * The dashboard's TOC table gives bare Pacific clock times ("7:30 AM") with no
 * date, newest first. Anchor each row to the most recent instant with that
 * wall-clock time at or before `serverTime`.
 */
export function tocToSamples(rows: unknown, serverTime: number): WaitSample[] {
  if (!Array.isArray(rows)) return [];
  const now = new Date(serverTime);
  const today = ptParts(now);
  const out: WaitSample[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const [timeStr, durStr] = row as string[];
    const minutes = parseTocDuration(String(durStr ?? ""));
    if (minutes === null) continue;
    const m = String(timeStr ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
    if (!m) continue;
    let hour = parseInt(m[1], 10) % 12;
    if (m[3].toLowerCase() === "p") hour += 12;
    const minute = parseInt(m[2], 10);

    let inst = ptInstant(today.y, today.mo, today.d, hour, minute);
    if (inst.getTime() > serverTime + 60_000) {
      inst = new Date(inst.getTime() - 86_400_000); // it was yesterday
    }
    out.push({ at: inst.toISOString(), minutes, source: "toc", raw: `${timeStr} — ${durStr}` });
  }
  return dedupeByAt(out);
}

export function trafficToSamples(posts: TrafficPost[]): WaitSample[] {
  return dedupeByAt(
    posts
      .filter((p) => p.minutes !== null)
      .map((p) => ({ at: p.createdAt, minutes: p.minutes as number, source: "bmantraffic" as const, raw: p.text })),
  );
}

export function dedupeByAt<T extends { at: string }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const r of rows) seen.set(r.at, r);
  return [...seen.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Merge sample sets, preferring TOC (finer grained, official) on collisions. */
export function mergeSamples(...sets: WaitSample[][]): WaitSample[] {
  const byKey = new Map<string, WaitSample>();
  for (const set of sets) {
    for (const s of set) {
      // bucket to 5 minutes so a tweet and a TOC row about the same moment collapse
      const key = String(Math.round(new Date(s.at).getTime() / 300_000));
      const prev = byKey.get(key);
      if (!prev || (prev.source !== "toc" && s.source === "toc")) byKey.set(key, s);
    }
  }
  return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/** Event-relative labels. Gate opens 12:01am Sunday 2026-08-30 Pacific. */
export const GATE_OPEN_ISO = "2026-08-30T07:01:00.000Z";

export function eventDayLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", { timeZone: PT, weekday: "short", month: "numeric", day: "numeric" }).format(d);
}

export function ptClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: PT, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function ptHour(iso: string): number {
  return ptParts(new Date(iso)).h;
}

export function ptDateKey(iso: string): string {
  const p = ptParts(new Date(iso));
  return `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
